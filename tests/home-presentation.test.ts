import { expect, test } from "bun:test";
import { bannerIndex, homeCollectionProducts, homeCollectionSearch, mobileNavSection } from "../src/lib/homePresentation";

test("Home shows only the first 20 collection products, preserving order", () => {
  const products = Array.from({ length: 300 }, (_, id) => ({ id }));
  expect(homeCollectionProducts(products).map(p => p.id)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  expect(products.length).toBe(300);
  expect(homeCollectionProducts(products.slice(0, 12)).length).toBe(12);
});
test("a clear category uses its real slug, custom collections fall back to Explorar", () => {
  const categories = [{ slug: "vestido", label: "Vestido" }, { slug: "calcas", label: "Calças" }];
  expect(homeCollectionSearch({ slug: "vestidos", name: "Vestidos" }, categories)).toEqual({ categoria: "vestido" });
  expect(homeCollectionSearch({ slug: "calcas", name: "Calças" }, categories)).toEqual({ categoria: "calcas" });
  expect(homeCollectionSearch({ slug: "escolhas-da-semana", name: "Escolhas da semana" }, categories)).toBeUndefined();
});
test("banners loop forwards and backwards without an end", () => {
  expect(bannerIndex(0, -1, 3)).toBe(2);
  expect(bannerIndex(2, 1, 3)).toBe(0);
  expect(bannerIndex(0, 1, 1)).toBe(0);
  expect(bannerIndex(0, -1, 0)).toBe(0);
});
test("mobile sections follow subroutes without assigning product details to a wrong section", () => {
  expect(mobileNavSection("/")).toBe("home");
  expect(mobileNavSection("/explorar")).toBe("explore");
  expect(mobileNavSection("/vendedor/produtos")).toBe("sell");
  expect(mobileNavSection("/tornar-se-vendedor")).toBe("sell");
  expect(mobileNavSection("/categorias")).toBe("categories");
  expect(mobileNavSection("/suporte/conversa")).toBe("support");
  expect(mobileNavSection("/produto/123")).toBeNull();
});