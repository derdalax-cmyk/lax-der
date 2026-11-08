import { test, expect } from "bun:test";
import { isCampaignEligible, missingProfileFields, needsRecentVerification, safeCampaignLink, campaignLink, plainText, maskEmail, MAX_CAMPAIGN_PRODUCTS } from "../src/lib/campaigns";
import { campaignRecipientLimit, campaignQueueCount, deterministicRecipients, campaignDispatchKey, mayRetryCampaign } from "../src/lib/campaigns";

test("default campaign limit is 50, only 50/75/100 are valid", () => {
  expect(campaignRecipientLimit()).toBe(50);
  for (const n of [50,75,100]) expect(campaignRecipientLimit(n)).toBe(n);
  for (const n of [0,49,51,101,1000,"50"]) expect(() => campaignRecipientLimit(n)).toThrow();
});
test("50 eligible-recipient cap never means 50 messages to one person", () => {
  const ids = Array.from({length:500},(_,i)=>String(i).padStart(4,"0"));
  const chosen = deterministicRecipients([...ids,...ids],50);
  expect(chosen).toHaveLength(50); expect(new Set(chosen).size).toBe(50);
  expect(campaignQueueCount(500,50)).toBe(50);
});
test("100 recipient cap and smaller eligible audiences are respected", () => {
  expect(deterministicRecipients(Array.from({length:1000},(_,i)=>String(i)),100)).toHaveLength(100);
  expect(campaignQueueCount(1000,100)).toBe(100); expect(campaignQueueCount(12,100)).toBe(12);
});
test("selection is deterministic and dispatch identity is per campaign/user/channel", () => {
  expect(deterministicRecipients(["c","a","b","a"],75)).toEqual(["a","b","c"]);
  expect(campaignDispatchKey("c","u","push")).toBe(campaignDispatchKey("c","u","push"));
  expect(campaignDispatchKey("c","u","push")).not.toBe(campaignDispatchKey("c","u","email"));
});
test("retries never redispatch a potentially accepted message", () => {
  expect(mayRetryCampaign(1,null)).toBe(true);
  expect(mayRetryCampaign(3,null)).toBe(false);
  expect(mayRetryCampaign(1,"2026-11-08T21:00:00Z")).toBe(false);
});

test("incomplete segment: missing name/phone/province/city counts, email alone does not complete a Google profile", () => {
  expect(missingProfileFields({ name: "Ana", phone: null, province: "Sofala", city: "Beira" })).toEqual(["Telefone"]);
  expect(missingProfileFields({ name: "  ", phone: "+258841234567", province: "", city: null })).toEqual(["Nome", "Província", "Cidade"]);
  // Google account: only email + name from provider
  expect(missingProfileFields({ name: "Google User" } as never).length).toBe(3);
  expect(missingProfileFields({ name: "Ana", phone: "+258841234567", province: "Sofala", city: "Beira" })).toEqual([]);
});
test("only approved available/reserved products may enter a campaign; max 15", () => {
  expect(isCampaignEligible({ approval_status: "approved", status: "available" })).toBe(true);
  expect(isCampaignEligible({ approval_status: "approved", status: "reserved" })).toBe(true);
  expect(isCampaignEligible({ approval_status: "approved", status: "sold" })).toBe(false);
  expect(isCampaignEligible({ approval_status: "rejected", status: "available" })).toBe(false);
  expect(MAX_CAMPAIGN_PRODUCTS).toBe(15);
});
test("links: internal paths or https DERDALAX only", () => {
  expect(safeCampaignLink("/perfil")).toBe("/perfil");
  expect(safeCampaignLink("https://derdalax.co.mz/explorar?q=saia")).toBe("/explorar?q=saia");
  expect(safeCampaignLink("http://derdalax.co.mz/x")).toBeNull();
  expect(safeCampaignLink("https://evil.com/")).toBeNull();
  expect(safeCampaignLink("//evil.com")).toBeNull();
  expect(safeCampaignLink("javascript:alert(1)")).toBeNull();
});
test("sending to everyone or more than 500 people needs a recent (5 min) re-verification", () => {
  expect(needsRecentVerification("all", 10)).toBe(true);
  expect(needsRecentVerification("incomplete", 501)).toBe(true);
  expect(needsRecentVerification("incomplete", 500)).toBe(false);
});
test("multi-product push opens the campaign landing; single product opens the product", () => {
  expect(campaignLink("products", "c1", ["p1"], "/")).toBe("/produto/p1");
  expect(campaignLink("products", "c1", ["p1", "p2"], "/")).toBe("/campanha/c1");
  expect(campaignLink("message", "c1", [], "/perfil")).toBe("/perfil");
});
test("admin text is plain (no HTML) and emails are masked", () => {
  expect(plainText("<b>Olá</b><script>x</script>", 50)).toBe("Oláx");
  expect(maskEmail("joaquim@gmail.com")).toBe("jo•••••@gmail.com");
});
