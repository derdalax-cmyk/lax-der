import { sendPushToUser } from "./push.server";
import { campaignDispatchKey, campaignLink, mayRetryCampaign, type CampaignType } from "./campaigns";

const BATCH = 80;

type Claimed = { id: string; campaign_id: string; user_id: string; channel: string; attempts: number };

/** Processes one claimed batch. Rows are claimed atomically (SKIP LOCKED) so re-runs never resend a "sent" row. */
export async function processCampaignBatch(limit = BATCH): Promise<{ processed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("admin_campaign_claim", { _limit: limit });
  if (error) throw new Error("claim_failed");
  const claimed = (rows ?? []) as Claimed[];
  if (!claimed.length) return { processed: 0 };

  const campaignIds = [...new Set(claimed.map((r) => r.campaign_id))];
  const [{ data: camps }, { data: prods }] = await Promise.all([
    supabaseAdmin.from("admin_campaigns").select("id,type,title,body,cta_url,image_url").in("id", campaignIds),
    supabaseAdmin.from("admin_campaign_products").select("campaign_id,product_id,sort_order").in("campaign_id", campaignIds).order("sort_order"),
  ]);
  const byId = new Map((camps ?? []).map((c) => [c.id, c]));

  await Promise.all(claimed.map(async (r) => {
    const c = byId.get(r.campaign_id);
    let status: "sent" | "failed" | "skipped" = "failed";
    let code: string | null = null;
    if (!c) { code = "campaign_missing"; }
    else if (r.channel === "email") { status = "skipped"; code = "email_channel_unavailable"; }
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
