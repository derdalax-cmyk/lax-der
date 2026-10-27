import { test, expect } from "bun:test";
import { productFeedCondition, uniqueProducts, PRODUCT_BATCH_SIZE } from "../src/lib/productFeed";
import { validateAiProductData } from "../src/lib/ai-product-validation";
import { isValidMzPhone, toMzE164, formatMzNationalPhone } from "../src/lib/validation";
import { loginDestination } from "../src/lib/safeRedirect";

test("continuous feed appends beyond 50 without duplicate IDs", () => {
  const rows = Array.from({ length: 100 }, (_, id) => ({ id: String(id) }));
  const result = uniqueProducts([rows.slice(0, 40), rows.slice(35, 80), rows.slice(80)]);
  expect(result).toHaveLength(100);
  expect(new Set(result.map((r) => r.id)).size).toBe(100);
  expect(PRODUCT_BATCH_SIZE).toBe(40);
});
test("cursor uses both timestamp and ID and preserves city filter", () => {
  expect(productFeedCondition("Beira", { created_at: "2026-10-27T00:00:00Z", id: "abc" })).toBe("and(or(city.eq.Beira,city.is.null),or(created_at.lt.2026-10-27T00:00:00Z,and(created_at.eq.2026-10-27T00:00:00Z,id.lt.abc)))");
  expect(productFeedCondition(null, null)).toBeNull();
});
test("new filter dataset contains no previous batch", () => {
  expect(uniqueProducts([[{ id: "filtered" }]])).toEqual([{ id: "filtered" }]);
});
test("normal admin login has home default", () => {
  expect(loginDestination(null, undefined)).toBe("/");
});
test("explicit admin destination is preserved, external destination rejected", () => {
  expect(loginDestination("/admin", undefined)).toBe("/admin");
  expect(loginDestination(null, "/admin/produtos")).toBe("/admin/produtos");
  expect(loginDestination("https://example.com", "//example.com")).toBe("/");
});
for (const prefix of [82, 83, 84, 85, 86, 87, 88]) {
  test(`Mozambique accepts prefix ${prefix} and stores +258`, () => {
    expect(isValidMzPhone(`${prefix} 000 0000`)).toBe(true);
    expect(toMzE164(`+258 ${prefix} 000 0000`)).toBe(`+258${prefix}0000000`);
    expect(toMzE164(`258${prefix}0000000`)).toBe(`+258${prefix}0000000`);
  });
}
test("reject other countries, prefixes and lengths", () => {
  for (const value of ["+27840000000", "810000000", "890000000", "84000000", "8400000000"]) expect(isValidMzPhone(value)).toBe(false);
  expect(formatMzNationalPhone("+258840000000")).toBe("84 000 0000");
});
const factual = { nome: "Camisa azul", descricao: "Camisa azul com gola e botões visíveis.", material: "Não identificado" };
test("professional factual description remains intact", () => {
  expect(validateAiProductData(factual)).toEqual(factual);
});
for (const term of ["dedos", "mãos", "pessoas", "pele", "corpo", "braços", "pernas", "rostos", "manequim", "fingers", "person"]) {
  test(`remove irrelevant ${term} claims server-side`, () => {
    expect(validateAiProductData({ ...factual, descricao: `${factual.descricao} Mostra ${term} na imagem.` }).descricao).toBe(factual.descricao);
  });
}
test("reject response consisting only of body claims", () => {
  expect(() => validateAiProductData({ ...factual, descricao: "Mãos e dedos na imagem." })).toThrow("ai_bad_image");
});
test("reject visibly self-contradictory output", () => {
  expect(() => validateAiProductData({ ...factual, descricao: "Camisa sem bolsos e com bolsos." })).toThrow("ai_bad_image");
});
test("do not accept inferred material", () => {
  expect(validateAiProductData({ ...factual, material: "Algodão" }).material).toBe("Não identificado");
  expect(validateAiProductData({ ...factual, material: "Etiqueta legível: algodão" }).material).toBe("Etiqueta legível: algodão");
});
test("reject malformed or overlong output", () => {
  expect(() => validateAiProductData({ ...factual, nome: "a".repeat(61) })).toThrow("ai_bad_image");
  expect(() => validateAiProductData({ ...factual, descricao: {} })).toThrow("ai_bad_image");
});