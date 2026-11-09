import { CAMPAIGN_EMAIL_FROM, SITE_URL } from "./campaignEmail";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

/** Sends one email via the linked Resend connector. Idempotency-Key makes Resend drop duplicates for 24h. */
export async function sendResendEmail(args: { to: string; subject: string; html: string; text: string; idempotencyKey: string; unsubscribeUrl: string }) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) throw new Error("resend_not_configured");
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
      "Idempotency-Key": args.idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from: CAMPAIGN_EMAIL_FROM, to: [args.to], subject: args.subject, html: args.html, text: args.text,
      headers: { "List-Unsubscribe": `<${args.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Resend send failed [${res.status}]: ${body.slice(0, 500)}`);
    let errorName: string | null = null;
    try { const j = JSON.parse(body) as { name?: unknown }; errorName = typeof j.name === "string" ? j.name : null; } catch { /* non-JSON */ }
    const ra = Number(res.headers.get("retry-after"));
    return { ok: false as const, status: res.status, errorName, retryAfter: Number.isFinite(ra) && ra > 0 ? ra : null };
  }
  let id: string | null = null;
  try { const j = JSON.parse(body) as { id?: unknown }; id = typeof j.id === "string" ? j.id : null; } catch { /* ignore */ }
  return { ok: true as const, status: res.status, id };
}

/** Returns (creating if needed) the per-address unsubscribe URL. */
export async function unsubscribeUrlFor(email: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const addr = email.trim().toLowerCase();
  const { data: existing } = await supabaseAdmin.from("email_unsubscribe_tokens").select("token").eq("email", addr).maybeSingle();
  let token = existing?.token;
  if (!token) {
    const fresh = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await supabaseAdmin.from("email_unsubscribe_tokens").upsert({ email: addr, token: fresh }, { onConflict: "email", ignoreDuplicates: true });
    const { data } = await supabaseAdmin.from("email_unsubscribe_tokens").select("token").eq("email", addr).maybeSingle();
    token = data?.token;
  }
  if (!token) throw new Error("unsubscribe_token_failed");
  return `${SITE_URL}/api/public/campaigns/unsubscribe?token=${encodeURIComponent(token)}`;
}
