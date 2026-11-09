import { test, expect, mock } from "bun:test";

let complete = false, eligible = true, status = "pending", gate = false, sends = 0, provider = "", accepted: unknown = null;
let response = { ok: true, status: 200, id: "resend-accepted" };
const profile = () => ({ name: "Maria", phone: "+258841234567", city: complete ? "Beira" : "", province: "Sofala", email: "maria@example.com", blocked: false, notification_preferences: {} });
const db = {
  rpc: async (name: string) => ({ error: null, data: name === "profile_reminder_claim" ? (status === "pending" ? (status = "processing", [{ id: "r", user_id: "u", cycle_id: "cycle", channel: "email", attempts: 1 }]) : []) : name.endsWith("eligible") ? eligible : null }),
  from: (table: string) => {
    let update: Record<string, unknown> | null = null, isGate = false;
    const finish = () => {
      if (table === "profiles") { if (update) accepted = update.profile_completion_reminder_sent_at; return { data: profile(), error: null }; }
      if (isGate) { if (gate) return { data: null, error: null }; gate = true; return { data: { id: "r" }, error: null }; }
      if (update) { status = String(update.status ?? status); if (update.dispatch_started_at === null) gate = false; if (update.provider_id) provider = String(update.provider_id); }
      return { data: null, error: null };
    };
    const q: any = { select: () => q, eq: () => q, not: () => q, is: () => { isGate = true; return q; }, update: (v: Record<string, unknown>) => { update = v; return q; }, maybeSingle: async () => finish(), then: (resolve: (r: unknown) => unknown) => Promise.resolve(finish()).then(resolve) };
    return q;
  },
};
mock.module("../src/integrations/supabase/client.server", () => ({ supabaseAdmin: db }));
mock.module("../src/lib/resend.server", () => ({ unsubscribeUrlFor: async () => "https://derdalax.co.mz/unsubscribe", sendResendEmail: async (args: { idempotencyKey: string }) => { expect(args.idempotencyKey).toBe("profile-completion:u:cycle:email"); sends++; return response; } }));
mock.module("../src/lib/push.server", () => ({ sendPushToUser: async () => { throw new Error("unexpected push"); } }));
const { processProfileReminders } = await import("../src/lib/profileCompletion.server");
function reset() { complete = false; eligible = true; status = "pending"; gate = false; sends = 0; provider = ""; accepted = null; response = { ok: true, status: 200, id: "resend-accepted" }; }
test("due incomplete profile: one accepted email with recorded provider id; retry cannot send again", async () => {
  reset(); await processProfileReminders(); await processProfileReminders(); expect(sends).toBe(1); expect(status).toBe("sent"); expect(provider).toBe("resend-accepted"); expect(accepted).toBeString();
});
test("completed before processing: no reminder", async () => { reset(); complete = true; await processProfileReminders(); expect(sends).toBe(0); expect(status).toBe("skipped"); });
test("opted-out/suppressed recipient: no forced reminder", async () => { reset(); eligible = false; await processProfileReminders(); expect(sends).toBe(0); expect(status).toBe("skipped"); });
test("429 then accepted retries without a second accepted reminder", async () => {
  reset(); response = { ok: false, status: 429, id: "" }; await processProfileReminders(); expect(status).toBe("pending"); expect(gate).toBe(false);
  response = { ok: true, status: 200, id: "accepted-after-429" }; await processProfileReminders(); await processProfileReminders(); expect(sends).toBe(2); expect(status).toBe("sent"); expect(provider).toBe("accepted-after-429");
});