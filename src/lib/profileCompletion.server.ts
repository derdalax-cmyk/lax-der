import { missingProfileFields, profileReminderKey } from "./profileCompletion";
import { deliverProfileReminder } from "./profileReminderDelivery";
import { isValidEmail, renderCampaignEmail } from "./campaignEmail";
import { sendResendEmail, unsubscribeUrlFor } from "./resend.server";
import { sendPushToUser } from "./push.server";

export async function processProfileReminders() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("profile_reminder_claim");
  if (error) throw new Error("profile_reminder_claim_failed");
  for (const row of rows ?? []) {
    let gated = false;
    try {
      const { data: p, error: pe } = await supabaseAdmin.from("profiles").select("name,phone,province,city,email,blocked,notification_preferences").eq("id", row.user_id).maybeSingle();
      if (pe) throw new Error("profile_read_failed");
      const prefs = (p?.notification_preferences ?? {}) as Record<string, unknown>;
      const { data: eligible, error: ee } = await supabaseAdmin.rpc(row.channel === "email" ? "admin_campaign_email_eligible" : "admin_campaign_push_eligible", { _user_id: row.user_id });
      if (ee) throw new Error("eligibility_failed");
      if (!p || !missingProfileFields(p).length || p.blocked || !eligible || (row.channel === "email" && (!isValidEmail(p.email) || prefs.email_enabled === false))) {
        await supabaseAdmin.from("profile_completion_reminders").update({ status: "skipped", error_code: "complete_or_ineligible" }).eq("id", row.id).eq("status", "processing");
        continue;
      }
      // Prepare before the durable gate; failures here are safe to retry.
      const address = p.email?.trim() ?? "";
      const unsubscribeUrl = row.channel === "email" ? await unsubscribeUrlFor(address) : "";
      const { data: gate, error: ge } = await supabaseAdmin.from("profile_completion_reminders").update({ dispatch_started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "processing").is("dispatch_started_at", null).select("id").maybeSingle();
      if (ge) throw new Error("dispatch_gate_failed");
      if (!gate) continue;
      gated = true;
      // Revalidate after acquiring the gate, including a completion during message preparation.
      const { data: fresh, error: fe } = await supabaseAdmin.from("profiles").select("name,phone,province,city").eq("id", row.user_id).maybeSingle();
      const { data: stillEligible, error: se } = await supabaseAdmin.rpc(row.channel === "email" ? "admin_campaign_email_eligible" : "admin_campaign_push_eligible", { _user_id: row.user_id });
      if (fe || se) throw new Error("revalidation_failed");
      if (!fresh || !missingProfileFields(fresh).length || !stillEligible) {
        await supabaseAdmin.from("profile_completion_reminders").update({ status: "skipped", error_code: "complete_or_ineligible" }).eq("id", row.id); continue;
      }
      const key = profileReminderKey(row.user_id, row.cycle_id, row.channel);
      const result = row.channel === "email" ? await deliverProfileReminder(async () => {
        const message = renderCampaignEmail({ type: "profile_recovery", title: "Complete o seu perfil na Derdalax", body: "A sua conta já está criada, mas alguns dados do perfil ainda estão em falta. Complete o seu perfil para facilitar compras, entregas e atendimento.", ctaLabel: "Completar perfil", ctaUrl: "/perfil", unsubscribeUrl });
        message.html = message.html.replace("Recebe este email porque tem uma conta na Derdalax e aceitou novidades por email.", "Recebe este lembrete relacionado com a sua conta na Derdalax.");
        return sendResendEmail({ to: address, ...message, unsubscribeUrl, idempotencyKey: key });
      }, row.attempts) : await (async () => {
        const r = await sendPushToUser(row.user_id, { title: "Complete o seu perfil", body: "Faltam alguns dados na sua conta Derdalax. Complete agora em poucos segundos.", url: "/perfil", tag: key });
        return { status: r.sent > 0 ? "sent" as const : "failed" as const, code: r.sent > 0 ? null : "push_not_accepted" };
      })();
      const now = new Date().toISOString();
      const saved = await supabaseAdmin.from("profile_completion_reminders").update({ status: result.status, error_code: result.code, updated_at: now,
        ...(result.status === "sent" ? { accepted_at: now, provider_id: "providerId" in result ? result.providerId : null } : {}),
        ...(result.status === "pending" ? { dispatch_started_at: null, due_at: result.retryAt, attempts: result.refundAttempt ? Math.max(0, row.attempts - 1) : row.attempts } : {}),
      }).eq("id", row.id).eq("status", "processing");
      if (saved.error) throw new Error("delivery_record_failed");
      if (result.status === "sent") {
        await supabaseAdmin.from("profiles").update({ profile_completion_reminder_sent_at: now }).eq("id", row.user_id).not("profile_completion_dismissed_at", "is", null);
      }
      if (row.channel === "email") await new Promise<void>((resolve) => setTimeout(resolve, 600));
    } catch {
      await supabaseAdmin.from("profile_completion_reminders").update({ status: !gated && row.attempts < 3 ? "pending" : "failed", error_code: gated ? "delivery_unknown" : "pre_dispatch_failed", due_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "processing");
    }
  }
  const { error: pauseError } = await supabaseAdmin.rpc("profile_reminder_pause_if_drained");
  if (pauseError) throw new Error("reminder_pause_failed");
  return { processed: rows?.length ?? 0 };
}