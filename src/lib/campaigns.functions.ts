import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_CAMPAIGN_PRODUCTS, PUSH_BODY_MAX, PUSH_TITLE_MAX, isCampaignEligible, maskEmail, missingProfileFields,
  needsRecentVerification, plainText, safeCampaignLink, campaignLink, type CampaignType,
} from "./campaigns";

const segment = z.enum(["incomplete", "all", "push", "email"]);
const filters = z.object({
  city: z.string().max(80).optional(),
  province: z.string().max(80).optional(),
  purchases: z.enum(["", "buyers", "no_purchases"]).optional(),
  role: z.enum(["", "sellers", "clients"]).optional(),
  created_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
  created_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
}).default({});

async function guard(userId: string) {
  const s = await import("./admin-security.server");
  await s.requireAdminStepUp(userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { s, db: supabaseAdmin };
}

function firstHttpsImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const f = images[0];
  const url = typeof f === "string" ? f : f && typeof f === "object" && "url" in f ? String((f as { url: unknown }).url) : null;
  return url && url.startsWith("https://") ? url : null;
}

export const estimateCampaignAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ segment, filters }).parse(d))
  .handler(async ({ data, context }) => {
    const { db } = await guard(context.userId);
    const { data: est, error } = await db.rpc("admin_campaign_estimate", { _segment: data.segment, _filters: data.filters });
    if (error) throw new Error("Não foi possível calcular o público.");
    return est as { total: number; push: number; email: number };
  });

export const searchCampaignProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(80).default(""), sellerIds: z.array(z.string().uuid()).max(50).default([]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { db } = await guard(context.userId);
    let q = db.from("products").select("id,title,base_price,images,status,seller_id,approval_status,sellers(store_name)")
      .eq("approval_status", "approved").in("status", ["available", "reserved"])
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(40);
    if (data.q.trim()) q = q.ilike("title", `%${data.q.trim().replace(/[%_,()]/g, "")}%`);
    if (data.sellerIds.length) q = q.in("seller_id", data.sellerIds);
    const { data: rows, error } = await q;
    if (error) throw new Error("Falha ao pesquisar produtos.");
    return (rows ?? []).map((p) => ({
      id: p.id, title: p.title, price: Number(p.base_price), status: p.status, image: firstHttpsImage(p.images),
      store: (p.sellers as { store_name?: string } | null)?.store_name ?? "—",
    }));
  });

export const listCampaignSellers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await guard(context.userId);
    const { data } = await db.from("sellers").select("id,store_name").eq("status", "approved").order("store_name").limit(500);
    return data ?? [];
  });

const campaignInput = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(["message", "profile_recovery", "products"]),
  channels: z.array(z.enum(["push", "email"])).min(1),
  recipientLimit: z.union([z.literal(50), z.literal(75), z.literal(100)]).default(50),
  segment,
  filters,
  title: z.string().min(2).max(PUSH_TITLE_MAX),
  body: z.string().min(2).max(PUSH_BODY_MAX),
  ctaLabel: z.string().max(40).default(""),
  ctaUrl: z.string().max(300).default("/"),
  productIds: z.array(z.string().uuid()).max(MAX_CAMPAIGN_PRODUCTS).default([]),
});

async function resolveProducts(db: Awaited<ReturnType<typeof guard>>["db"], ids: string[]) {
  if (!ids.length) return [];
  const { data } = await db.from("products").select("id,approval_status,status,images").in("id", ids);
  const rows = data ?? [];
  if (rows.length !== ids.length || rows.some((p) => !isCampaignEligible(p))) {
    throw new Error("Há produtos inválidos (vendidos, rejeitados ou inexistentes) na seleção.");
  }
  return ids.flatMap((id) => { const row = rows.find((r) => r.id === id); return row ? [row] : []; });
}

function clean(data: z.infer<typeof campaignInput>) {
  const ctaUrl = safeCampaignLink(data.ctaUrl || "/");
  if (!ctaUrl) throw new Error("Link inválido: use um caminho interno (ex: /perfil) ou um link https da Derdalax.");
  const title = plainText(data.title, PUSH_TITLE_MAX);
  const body = plainText(data.body, PUSH_BODY_MAX);
  if (!title || !body) throw new Error("Título e mensagem são obrigatórios.");
  if (data.type === "products" && data.productIds.length === 0) throw new Error("Selecione pelo menos um produto.");
  if (data.channels.includes("email")) throw new Error("EMAIL_CHANNEL_UNAVAILABLE");
  const segment = data.type === "profile_recovery" ? "incomplete" as const : data.segment;
  return { ...data, title, body, ctaUrl, segment, ctaLabel: plainText(data.ctaLabel, 40) };
}

export const sendCampaignTestToMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => campaignInput.parse(d))
  .handler(async ({ data, context }) => {
    const { db } = await guard(context.userId);
    const c = clean(data);
    const prods = await resolveProducts(db, c.productIds);
    const { data: eligible, error: eligibilityError } = await db.rpc("admin_campaign_push_eligible", { _user_id: context.userId });
    if (eligibilityError) throw new Error("Não foi possível verificar a elegibilidade do teste.");
    if (!eligible) return { push: "ineligible" as const };
    const { sendPushToUser } = await import("./push.server");
    const url = c.type === "products" ? (c.productIds.length === 1 ? `/produto/${c.productIds[0]}` : "/explorar") : c.ctaUrl;
    const res = await sendPushToUser(context.userId, { title: `[Teste] ${c.title}`, body: c.body, url, tag: "campaign-test", image: firstHttpsImage(prods[0]?.images) ?? undefined });
    return { push: res.sent > 0 ? "sent" as const : res.total === 0 ? "no_subscription" as const : "failed" as const };
  });

export const createAndSendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => campaignInput.parse(d))
  .handler(async ({ data, context }) => {
    const { s, db } = await guard(context.userId);
    const c = clean(data);
    const prods = await resolveProducts(db, c.productIds);
    const { data: est } = await db.rpc("admin_campaign_estimate", { _segment: c.segment, _filters: c.filters });
    const e = (est ?? { total: 0, push: 0, email: 0 }) as { total: number; push: number; email: number };
    if (needsRecentVerification(c.segment, e.total)) await s.requireRecentAdminVerification(context.userId);

    // Double-submit guard: the same admin cannot dispatch an identical campaign twice within 2 minutes.
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: dup } = await db.from("admin_campaigns").select("id").eq("created_by", context.userId).eq("title", c.title).eq("body", c.body).gte("created_at", since).limit(1);
    if (dup?.length) throw new Error("Esta campanha acabou de ser enviada.");

    const { data: row, error } = await db.from("admin_campaigns").insert({
      created_by: context.userId, name: plainText(c.name, 100), type: c.type, audience_type: c.segment,
      audience_filters: c.filters as never, channels: c.channels as never, title: c.title, body: c.body,
      cta_label: c.ctaLabel || null, cta_url: c.ctaUrl, image_url: firstHttpsImage(prods[0]?.images),
      estimated_push: c.channels.includes("push") ? e.push : 0, estimated_email: 0,
      recipient_limit: c.recipientLimit, eligible_total: e.total,
    }).select("id").single();
    if (error || !row) throw new Error("Não foi possível criar a campanha.");
    if (c.productIds.length) {
      await db.from("admin_campaign_products").insert(c.productIds.map((product_id, i) => ({ campaign_id: row.id, product_id, sort_order: i })));
    }
    await s.audit(context.userId, "campaign.created", { type: c.type, segment: c.segment, channels: c.channels, limit: c.recipientLimit, products: c.productIds.length }, row.id);
    const { data: queued, error: qErr } = await db.rpc("admin_campaign_enqueue", { _campaign_id: row.id });
    if (qErr) throw new Error("Falha ao colocar a campanha na fila.");
    await s.audit(context.userId, "campaign.sent", { recipients: queued }, row.id);
    // Process the first batch right away; the rest runs in the background queue.
    const { processCampaignBatch } = await import("./campaigns.server");
    await processCampaignBatch().catch(() => undefined);
    return { id: row.id, queued: Number(queued ?? 0) };
  });

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await guard(context.userId);
    const { data } = await db.from("admin_campaigns")
      .select("id,name,type,audience_type,channels,status,estimated_push,estimated_email,sent_push,failed_push,sent_email,failed_email,created_at,created_by,recipient_limit,eligible_total,queued_push,queued_email")
      .order("created_at", { ascending: false }).limit(100);
    const ids = [...new Set((data ?? []).map((c) => c.created_by))];
    const { data: profs } = ids.length ? await db.from("profiles").select("id,name").in("id", ids) : { data: [] };
    return (data ?? []).map(({ created_by, ...c }) => ({ ...c, createdBy: profs?.find((p) => p.id === created_by)?.name || "Admin" }));
  });

export const getCampaignDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db } = await guard(context.userId);
    const { data: c } = await db.from("admin_campaigns").select("id,name,type,title,body,cta_label,cta_url,status,audience_type,audience_filters,channels,sent_push,failed_push,estimated_push,created_at,completed_at,recipient_limit,eligible_total,queued_push,queued_email").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Campanha não encontrada.");
    const [{ data: prods }, { data: recs }] = await Promise.all([
      db.from("admin_campaign_products").select("sort_order,products(id,title,base_price)").eq("campaign_id", data.id).order("sort_order"),
      db.from("admin_campaign_recipients").select("status,error_code,channel").eq("campaign_id", data.id).limit(200),
    ]);
    const byStatus: Record<string, number> = {};
    const failures: Record<string, number> = {};
    for (const r of recs ?? []) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if ((r.status === "failed" || r.status === "skipped") && r.error_code) failures[r.error_code] = (failures[r.error_code] ?? 0) + 1;
    }
    return {
      campaign: c,
      products: (prods ?? []).map((p) => p.products as { id: string; title: string; base_price: number } | null).filter(Boolean),
      byStatus, failures,
    };
  });

export const cancelCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { s, db } = await guard(context.userId);
    const { count } = await db.from("admin_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", data.id).eq("status", "pending");
    if (!count) throw new Error("Já não há envios pendentes para cancelar.");
    const { data: c } = await db.from("admin_campaigns").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", data.id).in("status", ["queued", "sending"]).select("id").maybeSingle();
    if (!c) throw new Error("Esta campanha já não pode ser cancelada.");
    await db.from("admin_campaign_recipients").update({ status: "skipped", error_code: "cancelled" }).eq("campaign_id", data.id).eq("status", "pending");
    await db.rpc("admin_campaign_refresh", { _campaign_id: data.id });
    await s.audit(context.userId, "campaign.cancelled", {}, data.id);
    return { ok: true };
  });

const PAGE = 25;
export const listIncompleteAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ page: z.number().int().min(0).max(100000).default(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const { db } = await guard(context.userId);
    const incomplete = "name.is.null,name.eq.,phone.is.null,phone.eq.,province.is.null,province.eq.,city.is.null,city.eq.";
    const { data: rows, count } = await db.from("profiles").select("id,name,email,phone,province,city,created_at", { count: "exact" })
      .eq("blocked", false).or(incomplete).order("created_at", { ascending: false }).order("id")
      .range(data.page * PAGE, data.page * PAGE + PAGE - 1);
    const ids = (rows ?? []).map((r) => r.id);
    const { data: subs } = ids.length ? await db.from("push_subscriptions").select("user_id").in("user_id", ids) : { data: [] };
    const withPush = new Set((subs ?? []).map((x) => x.user_id));
    return {
      total: count ?? 0, pageSize: PAGE,
      rows: (rows ?? []).map((r) => ({
        id: r.id, name: r.name?.trim() || null, email: maskEmail(r.email), missing: missingProfileFields(r), createdAt: r.created_at, hasPush: withPush.has(r.id),
      })),
    };
  });

export const sendProfileReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { s, db } = await guard(context.userId);
    const { data: p } = await db.from("profiles").select("name,phone,province,city,notification_preferences").eq("id", data.userId).maybeSingle();
    if (!p || missingProfileFields(p).length === 0) throw new Error("Este perfil já está completo.");
    const prefs = (p.notification_preferences ?? {}) as { marketing_push?: boolean };
    if (prefs.marketing_push === false) return { push: "opted_out" as const };
    const { PROFILE_RECOVERY_DEFAULTS: d } = await import("./campaigns");
    const { sendPushToUser } = await import("./push.server");
    const res = await sendPushToUser(data.userId, { title: d.title, body: d.body, url: d.url, tag: "profile-reminder" });
    await s.audit(context.userId, "campaign.reminder", { sent: res.sent }, data.userId);
    return { push: res.sent > 0 ? "sent" as const : res.total === 0 ? "no_subscription" as const : "failed" as const };
  });

export { campaignLink };
export type { CampaignType };
