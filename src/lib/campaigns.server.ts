import { sendPushToUser } from "./push.server";
import { campaignDispatchKey, campaignLink, mayRetryCampaign, type CampaignType } from "./campaigns";

import { isValidEmail, renderCampaignEmail, type EmailProduct } from "./campaignEmail";
import { sendResendEmail, unsubscribeUrlFor } from "./resend.server";
import { safePublicImage } from "./publicCachePolicy";

const BATCH = 80;

type CampaignRow = { id: string; type: string; title: string; body: string; cta_url: string | null; cta_label?: string | null };
const productCache = new Map<string, EmailProduct[]>();

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const f = images[0];
  const url = typeof f === "string" ? f : f && typeof f === "object" && "url" in f ? String((f as { url: unknown }).url) : null;
  return url && safePublicImage(url) && /^https:\/\//i.test(url) ? url : null;
}

export async function loadEmailProducts(ids: string[]): Promise<EmailProduct[]> {
  if (!ids.length) return [];
  const key = ids.join(",");
  const hit = productCache.get(key);
  if (hit) return hit;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("products").select("id,title,base_price,images,approval_status,status").in("id", ids);
  const rows = (data ?? []).filter((p) => p.approval_status === "approved" && p.status !== "sold");
  const out = ids.flatMap((id) => { const p = rows.find((r) => r.id === id); return p ? [{ id: p.id, title: p.title, price: Number(p.base_price), image: firstImage(p.images) }] : []; });
  productCache.set(key, out);
  return out;
}

export async function buildCampaignEmail(c: CampaignRow, productIds: string[], email: string, subjectPrefix = "") {
  const unsubscribeUrl = await unsubscribeUrlFor(email);
  const products = c.type === "products" ? await loadEmailProducts(productIds) : [];
  const m = renderCampaignEmail({ type: c.type as "message", title: c.title, body: c.body, ctaLabel: c.cta_label, ctaUrl: c.cta_url ?? "/", products, unsubscribeUrl });
  return { subject: subjectPrefix + m.subject, html: m.html, text: m.text, unsubscribeUrl };
}

type Claimed = { id: string; campaign_id: string; user_id: string; channel: string; attempts: number };

/** Processes one claimed batch. Rows are claimed atomically (SKIP LOCKED) so re-runs never resend a "sent" row. */
export async function processCampaignBatch(limit = BATCH): Promise<{ processed: number }> {
  productCache.clear();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("admin_campaign_claim", { _limit: limit });
  if (error) throw new Error("claim_failed");
  const claimed = (rows ?? []) as Claimed[];
  if (!claimed.length) return { processed: 0 };

  const campaignIds = [...new Set(claimed.map((r) => r.campaign_id))];
  const [{ data: camps }, { data: prods }] = await Promise.all([
    supabaseAdmin.from("admin_campaigns").select("id,type,title,body,cta_url,cta_label,image_url").in("id", campaignIds),
    supabaseAdmin.from("admin_campaign_products").select("campaign_id,product_id,sort_order").in("campaign_id", campaignIds).order("sort_order"),
  ]);
  const byId = new Map((camps ?? []).map((c) => [c.id, c]));

  await Promise.all(claimed.map(async (r) => {
    const c = byId.get(r.campaign_id);
    let status: "sent" | "failed" | "skipped" = "failed";
    let code: string | null = null;
    if (!c) { code = "campaign_missing"; }
    else if (r.channel === "email") {
      const ids = (prods ?? []).filter((p) => p.campaign_id === c.id).map((p) => p.product_id);
      try {
        const { data: eligible, error: eErr } = await supabaseAdmin.rpc("admin_campaign_email_eligible", { _user_id: r.user_id });
        if (eErr) throw new Error("eligibility_failed");
        const { data: prof } = await supabaseAdmin.from("profiles").select("email").eq("id", r.user_id).maybeSingle();
        if (!eligible || !isValidEmail(prof?.email)) {
          await supabaseAdmin.from("admin_campaign_recipients").update({ status: "skipped", error_code: "email_ineligible", updated_at: new Date().toISOString() }).eq("id", r.id).eq("status", "processing");
          return;
        }
        const email = prof!.email!.trim();
        const message = await buildCampaignEmail(c, ids, email);
        const { data: gate, error: gateError } = await supabaseAdmin.from("admin_campaign_recipients")
          .update({ dispatch_started_at: new Date().toISOString() }).eq("id", r.id).eq("status", "processing")
          .is("dispatch_started_at", null).select("id").maybeSingle();
        if (gateError) throw new Error("dispatch_gate_failed");
        if (!gate) return;
        const res = await sendResendEmail({ to: email, ...message, idempotencyKey: campaignDispatchKey(c.id, r.user_id, `email:${email.toLowerCase()}`) });
        if (res.ok) status = "sent"; else code = `email_rejected_${res.status}`;
      } catch { code = "delivery_unknown"; }
      const { data: delivery } = await supabaseAdmin.from("admin_campaign_recipients").select("dispatch_started_at").eq("id", r.id).maybeSingle();
      if (status === "failed" && delivery && mayRetryCampaign(r.attempts, delivery.dispatch_started_at)) {
        await supabaseAdmin.from("admin_campaign_recipients").update({ status: "pending", error_code: code, updated_at: new Date().toISOString() }).eq("id", r.id).eq("status", "processing");
        return;
      }
    }
    else {
      const ids = (prods ?? []).filter((p) => p.campaign_id === c.id).map((p) => p.product_id);
      try {
        // Recheck preferences/subscription after queueing. Failure here has not dispatched anything.
        const { data: eligible, error: eligibilityError } = await supabaseAdmin.rpc("admin_campaign_push_eligible", { _user_id: r.user_id });
        if (eligibilityError) throw new Error("eligibility_failed");
        if (!eligible) {
          await supabaseAdmin.from("admin_campaign_recipients").update({ status: "skipped", error_code: "ineligible", updated_at: new Date().toISOString() }).eq("id", r.id).eq("status", "processing");
          return;
        }
        // Durable at-most-once dispatch gate: never retry a potentially accepted network send.
        const { data: gate, error: gateError } = await supabaseAdmin.from("admin_campaign_recipients")
          .update({ dispatch_started_at: new Date().toISOString() }).eq("id", r.id).eq("status", "processing")
          .is("dispatch_started_at", null).select("id").maybeSingle();
        if (gateError) throw new Error("dispatch_gate_failed");
        if (!gate) return;
        const res = await sendPushToUser(r.user_id, {
          title: c.title, body: c.body, tag: campaignDispatchKey(c.id, r.user_id, "push"),
          url: campaignLink(c.type as CampaignType, c.id, ids, c.cta_url),
          image: c.image_url ?? undefined,
        });
        if (res.total === 0 || (res.sent === 0 && res.removed === res.total)) { status = "skipped"; code = "no_subscription"; }
        else if (res.sent > 0) status = "sent";
        else code = "push_rejected";
      } catch { code = "delivery_unknown"; }
      // Retry only pre-dispatch failures; ambiguous delivery is terminal, prioritising no duplicates.
      const { data: delivery } = await supabaseAdmin.from("admin_campaign_recipients").select("dispatch_started_at").eq("id", r.id).maybeSingle();
      if (status === "failed" && delivery && mayRetryCampaign(r.attempts, delivery.dispatch_started_at)) {
        await supabaseAdmin.from("admin_campaign_recipients").update({ status: "pending", error_code: code, updated_at: new Date().toISOString() }).eq("id", r.id).eq("status", "processing");
        return;
      }
    }
    await supabaseAdmin.from("admin_campaign_recipients").update({
      status, error_code: code, sent_at: status === "sent" ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
    }).eq("id", r.id).eq("status", "processing");
  }));

  for (const id of campaignIds) {
    await supabaseAdmin.rpc("admin_campaign_refresh", { _campaign_id: id });
    const { data: c } = await supabaseAdmin.from("admin_campaigns").select("status,created_by").eq("id", id).maybeSingle();
    if (c?.status === "completed") {
      const { data: logged } = await supabaseAdmin.from("activity_logs").select("id").eq("entity_id", id).eq("action", "campaign.completed").limit(1);
      if (!logged?.length) {
        await supabaseAdmin.from("activity_logs").insert({ actor_id: c.created_by, entity_type: "admin_campaign", entity_id: id, action: "campaign.completed", changes: {} as never });
      }
    }
  }
  return { processed: claimed.length };
}
