import { test, expect, mock } from "bun:test";

let eligible = true;
let dispatched = false;
let status = "processing";
let errorCode: string | null = null;
let sends = 0;
let channel = "push";
let result = { sent: 1, total: 1, removed: 0 };
const db = {
  rpc: async (name: string) => ({ data: name === "admin_campaign_claim" ? [{ id: "r", campaign_id: "c", user_id: "u", channel, attempts: 1 }] : name === "admin_campaign_push_eligible" ? eligible : null, error: null }),
  from: (table: string) => {
    let update: Record<string, unknown> | null = null;
    let gate = false;
    const terminal = () => {
      if (table === "admin_campaigns") return { data: [{ id: "c", type: "message", title: "Test", body: "Body", cta_url: "/", image_url: null }], error: null };
      if (table === "admin_campaign_products") return { data: [], error: null };
      if (gate) {
        if (dispatched) return { data: null, error: null };
        dispatched = true; return { data: { id: "r" }, error: null };
      }
      if (update) { if (typeof update.status === "string") status = update.status; errorCode = String(update.error_code ?? ""); }
      return { data: { dispatch_started_at: dispatched ? "started" : null }, error: null };
    };
    const q: any = {
      select: () => q, in: () => q, order: () => q, eq: () => q,
      is: () => { gate = true; return q; },
      update: (v: Record<string, unknown>) => { update = v; return q; },
      maybeSingle: async () => table === "admin_campaigns" ? { data: { status: "sending" } } : terminal(),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(terminal()).then(resolve),
    };
    return q;
  },
};
mock.module("../src/integrations/supabase/client.server", () => ({ supabaseAdmin: db }));
mock.module("../src/lib/push.server", () => ({ sendPushToUser: async () => { sends++; return result; } }));
const { processCampaignBatch } = await import("../src/lib/campaigns.server");
function reset() { eligible = true; dispatched = false; status = "processing"; errorCode = null; sends = 0; channel = "push"; result = { sent: 1, total: 1, removed: 0 }; }

test("campaign worker rechecks opt-out and skips without sending", async () => {
  reset(); eligible = false; await processCampaignBatch();
  expect(sends).toBe(0); expect(status).toBe("skipped"); expect(errorCode).toBe("ineligible");
});
test("same recipient cannot be sent twice when a batch is retried", async () => {
  reset(); await processCampaignBatch(); await processCampaignBatch();
  expect(sends).toBe(1); expect(dispatched).toBe(true);
});
test("subscription removed after queueing is skipped without a retry", async () => {
  reset(); result = { sent: 0, total: 0, removed: 0 }; await processCampaignBatch();
  expect(status).toBe("skipped"); expect(errorCode).toBe("no_subscription");
  await processCampaignBatch(); expect(sends).toBe(1);
});
test("a rejected post-dispatch Push cannot return to pending", async () => {
  reset(); result = { sent: 0, total: 1, removed: 0 }; await processCampaignBatch();
  expect(status).toBe("failed"); await processCampaignBatch(); expect(sends).toBe(1);
});
test("Email cannot enter the app-email queue through campaign worker", async () => {
  reset(); channel = "email"; await processCampaignBatch();
  expect(sends).toBe(0); expect(status).toBe("skipped"); expect(errorCode).toBe("email_channel_unavailable");
});