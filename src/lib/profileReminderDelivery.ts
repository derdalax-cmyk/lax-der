import { classifyEmailSend } from "./campaigns";

export type ReminderDeliveryResult = { status: "sent" | "pending" | "failed"; code: string | null; retryAt?: string; providerId?: string | null; refundAttempt?: boolean };
/** Explicit refusals may retry; an ambiguous network acceptance must never resend. */
export async function deliverProfileReminder(send: () => Promise<{ ok: boolean; status: number; id?: string | null; errorName?: string | null; retryAfter?: number | null }>, attempts: number): Promise<ReminderDeliveryResult> {
  try {
    const res = await send();
    const outcome = classifyEmailSend(res, attempts);
    if (outcome.kind === "sent") return { status: "sent", code: null, providerId: res.id };
    if (outcome.kind === "failed") return { status: "failed", code: outcome.code };
    return { status: "pending", code: outcome.code, retryAt: outcome.retryAt.toISOString(), refundAttempt: outcome.kind !== "transient" };
  } catch { return { status: "failed", code: "delivery_unknown" }; }
}