import { test, expect } from "bun:test";
import { missingProfileFields, shouldPromptProfile, reminderDue, profileReminderKey } from "../src/lib/profileCompletion";
import { deliverProfileReminder } from "../src/lib/profileReminderDelivery";

const complete = { name: "Maria", phone: "+258841234567", province: "Sofala", city: "Beira" };
const at = Date.parse("2026-11-09T20:00:00Z");
const dismissed = { ...complete, city: "", profile_completion_dismissed_at: new Date(at).toISOString() };
test("manual signup with all four valid fields is complete", () => expect(missingProfileFields(complete)).toEqual([]));
test("Google profile missing delivery fields prompts optionally", () => expect(shouldPromptProfile({ name: "Maria" }, at)).toBe(true));
test("name must be nonblank", () => expect(missingProfileFields({ ...complete, name: " " })).toEqual(["Nome"]));
test("phone must be valid Mozambican 82–88 mobile", () => expect(missingProfileFields({ ...complete, phone: "+258811234567" })).toEqual(["Telefone"]));
test("province must belong to the ten supported provinces", () => expect(missingProfileFields({ ...complete, province: "Maputo Cidade" })).toEqual(["Província"]));
test("city must be nonblank", () => expect(missingProfileFields({ ...complete, city: " " })).toEqual(["Cidade"]));
test("dismissal survives reload and suppresses until seven days", () => {
  expect(shouldPromptProfile(JSON.parse(JSON.stringify(dismissed)), at + 1)).toBe(false);
  expect(shouldPromptProfile(dismissed, at + 7 * 86400000 - 1)).toBe(false);
  expect(shouldPromptProfile(dismissed, at + 7 * 86400000)).toBe(true);
});
test("reminder cannot run before 30 minutes", () => expect(reminderDue(dismissed, null, at + 1799999)).toBe(false));
test("incomplete profile gets due reminder at 30 minutes", () => expect(reminderDue(dismissed, null, at + 1800000)).toBe(true));
test("completion before due cancels reminder", () => expect(reminderDue({ ...complete, profile_completion_dismissed_at: dismissed.profile_completion_dismissed_at }, null, at + 1800000)).toBe(false));
test("accepted reminder is not due again", () => expect(reminderDue(dismissed, new Date(at + 1800000).toISOString(), at + 3600000)).toBe(false));
test("retry preserves key; new cycle and channel are distinct", () => {
  expect(profileReminderKey("u", "cycle1", "email")).toBe("profile-completion:u:cycle1:email");
  expect(profileReminderKey("u", "cycle1", "email")).not.toBe(profileReminderKey("u", "cycle2", "email"));
  expect(profileReminderKey("u", "cycle1", "email")).not.toBe(profileReminderKey("u", "cycle1", "push"));
});
test("explicit refusal can retry then acceptance records provider id", async () => {
  let calls = 0;
  const send = async () => ++calls === 1 ? { ok: false, status: 429 } : { ok: true, status: 200, id: "accepted1" };
  expect((await deliverProfileReminder(send, 1)).status).toBe("pending");
  expect(await deliverProfileReminder(send, 1)).toEqual({ status: "sent", code: null, providerId: "accepted1" });
  expect(calls).toBe(2);
});
test("ambiguous network acceptance is terminal, not retryable", async () => expect(await deliverProfileReminder(async () => { throw new Error("timeout"); }, 1)).toEqual({ status: "failed", code: "delivery_unknown" }));