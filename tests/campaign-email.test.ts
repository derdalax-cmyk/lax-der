import { expect, test } from "bun:test";
import { CAMPAIGN_EMAIL_FROM, campaignEmailCta, isValidEmail, renderCampaignEmail } from "../src/lib/campaignEmail";
import { campaignDispatchKey, campaignQueueCount, mayRetryCampaign } from "../src/lib/campaigns";

const unsub = "https://derdalax.co.mz/api/public/campaigns/unsubscribe?token=abc";

test("From is Derdalax on the verified news subdomain", () => {
  expect(CAMPAIGN_EMAIL_FROM).toBe("Derdalax <campanhas@news.derdalax.co.mz>");
});

test("admin content is escaped and never injected as HTML", () => {
  const { html } = renderCampaignEmail({ type: "message", title: "<script>x</script>", body: "<b>oi</b>", ctaUrl: "/", unsubscribeUrl: unsub });
  expect(html).not.toContain("<script>x");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;b&gt;oi&lt;/b&gt;");
});

test("product campaign shows image, title, price and individual link", () => {
  const { html } = renderCampaignEmail({ type: "products", title: "Novidades", body: "Veja", ctaUrl: "/", unsubscribeUrl: unsub,
    products: [{ id: "p1", title: "Vestido azul", price: 1250.5, image: "https://cdn.test/a.jpg" }, { id: "p2", title: "Blusa", price: 300, image: "http://insecure/b.jpg" }] });
  expect(html).toContain('src="https://cdn.test/a.jpg"');
  expect(html).not.toContain("http://insecure");
  expect(html).toContain("Vestido azul");
  expect(html).toContain("1250,5 MT");
  expect(html).toContain("https://derdalax.co.mz/produto/p1");
  expect(html).toContain("https://derdalax.co.mz/produto/p2");
});

test("profile recovery email CTA opens /perfil", () => {
  expect(campaignEmailCta({ type: "profile_recovery", ctaUrl: "/explorar" })).toBe("https://derdalax.co.mz/perfil");
});

test("every campaign email carries the unsubscribe link", () => {
  const { html, text } = renderCampaignEmail({ type: "message", title: "T", body: "B", ctaUrl: "/", unsubscribeUrl: unsub });
  expect(html).toContain(unsub);
  expect(text).toContain(unsub);
});

test("invalid email is rejected", () => {
  expect(isValidEmail("ana@mail.co.mz")).toBe(true);
  expect(isValidEmail("ana@")).toBe(false);
  expect(isValidEmail("")).toBe(false);
});

test("email queue never exceeds the chosen limit (default 50)", () => {
  expect(campaignQueueCount(500, 50)).toBe(50);
  expect(campaignQueueCount(12, 50)).toBe(12);
});

test("Push and Email use distinct idempotency keys per user, so one of each and no duplicates", () => {
  expect(campaignDispatchKey("c", "u", "push")).not.toBe(campaignDispatchKey("c", "u", "email:a@b.co"));
  expect(campaignDispatchKey("c", "u", "email:a@b.co")).toBe(campaignDispatchKey("c", "u", "email:a@b.co"));
});

test("a retry after dispatch started never resends", () => {
  expect(mayRetryCampaign(1, "2026-11-09T00:00:00Z")).toBe(false);
  expect(mayRetryCampaign(1, null)).toBe(true);
});
