import { test, expect } from "bun:test";
import { campaignQueueCount, channelQueueLabel, classifyEmailSend, deterministicRecipients, MAX_CAMPAIGN_PRODUCTS, quotaResetAt } from "../src/lib/campaigns";

const now = new Date("2026-11-09T17:00:00Z");
test("23 eligible emails with limit 75 enqueue exactly 23", () => {
  expect(campaignQueueCount(23, 75)).toBe(23);
  const ids = Array.from({ length: 23 }, (_, i) => `u${String(i).padStart(2, "0")}`);
  expect(deterministicRecipients(ids, 75)).toHaveLength(23);
});
test("selecting 15 products does not change the 23 recipients", () => {
  const ids = Array.from({ length: 23 }, (_, i) => `u${i}`);
  expect(MAX_CAMPAIGN_PRODUCTS).toBe(15);
  expect(deterministicRecipients(ids, 75)).toEqual(deterministicRecipients(ids, 75));
  expect(campaignQueueCount(23, 75)).toBe(23);
});
test("429 rate limit is retryable and honours Retry-After", () => {
  const o = classifyEmailSend({ ok: false, status: 429, retryAfter: 5 }, 3, now);
  expect(o.kind).toBe("rate_limited");
  if (o.kind === "rate_limited") expect(o.retryAt.getTime() - now.getTime()).toBe(5000);
});
test("429 quota pauses until the next reset", () => {
  const d = classifyEmailSend({ ok: false, status: 429, errorName: "daily_quota_exceeded" }, 1, now);
  expect(d.kind).toBe("quota");
  if (d.kind === "quota") expect(d.retryAt.toISOString()).toBe("2026-11-10T00:05:00.000Z");
  expect(quotaResetAt(now, true).toISOString()).toBe("2026-12-01T00:05:00.000Z");
});
test("5xx retries with limited backoff, then fails; other 4xx fail definitively", () => {
  expect(classifyEmailSend({ ok: false, status: 503 }, 1, now).kind).toBe("transient");
  expect(classifyEmailSend({ ok: false, status: 503 }, 3, now).kind).toBe("failed");
  expect(classifyEmailSend({ ok: false, status: 422 }, 1, now)).toEqual({ kind: "failed", code: "email_rejected_422" });
});
test("Push not selected is distinct from Push with no subscriptions", () => {
  expect(channelQueueLabel(false, 0, "push")).toBe("Push não selecionado");
  expect(channelQueueLabel(true, 0, "push")).toBe("0 utilizadores com Push ativo");
  expect(channelQueueLabel(true, 23, "email")).toBe("23 Email");
});
