import { test, expect } from "bun:test";
import { isCampaignEligible, missingProfileFields, needsRecentVerification, safeCampaignLink, campaignLink, plainText, maskEmail, MAX_CAMPAIGN_PRODUCTS } from "../src/lib/campaigns";

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
