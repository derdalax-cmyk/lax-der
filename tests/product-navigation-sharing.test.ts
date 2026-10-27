import { test, expect } from "bun:test";
import { primaryProductImage, productPageHead, recommendationSections, shareProduct, type PublicProduct } from "../src/lib/productDetails";
import { uniqueProducts } from "../src/lib/productFeed";

const product: PublicProduct = { id: "one", title: "Camisa azul", description: "Camisa com botões.<!--META:{\"gender\":\"unissex\"}-->", images: ["https://images.example/one.jpg", "https://images.example/other.jpg"], base_price: 250.5, original_price: 300, is_unique: true, status: "available", category: "camisas", seller_id: "seller", city: "Beira", shipping_fee: 0, reserved_until: null };
test("main image is the first real product photo, never another product or a logo fallback", () => {
  expect(primaryProductImage(product.images)).toBe("https://images.example/one.jpg");
  expect(primaryProductImage([])).toBeNull();
  expect(primaryProductImage([{ url: "https://images.example/one.jpg" }])).toBe("https://images.example/one.jpg");
});
test("each product gets self-referencing metadata and its own image without stale prior data", () => {
  const first = productPageHead("one", product);
  const second = productPageHead("two", { ...product, id: "two", title: "Saia", images: ["https://images.example/two.jpg"] });
  expect(first.links[0].href).toBe("https://derdalax.co.mz/produto/one");
  expect(first.meta.find(m => "property" in m && m.property === "og:image")?.content).toBe("https://images.example/one.jpg");
  expect(second.meta.find(m => "property" in m && m.property === "og:image")?.content).toBe("https://images.example/two.jpg");
  expect(second.meta[0]).toEqual({ title: "Saia · Derdalax" });
  expect(first.meta.find(m => "name" in m && m.name === "description")?.content).toBe("Camisa com botões.");
  expect(productPageHead("missing", null).meta.some(m => "property" in m && m.property === "og:image")).toBe(false);
});
test("related and seller sections each cap at five and exclude current, sold and duplicate products", () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({ ...product, id: String(i) }));
  const sections = recommendationSections("one", [product, { ...product, id: "sold", status: "sold" }, ...rows], rows.slice(0, 5));
  expect(sections.sellerProducts.map(p => p.id)).toEqual(["0", "1", "2", "3", "4"]);
  expect(sections.related.map(p => p.id)).toEqual(["5", "6", "7", "8", "9"]);
});
test("cached batches retain the exact original order when reused", () => {
  const batches = [[{ id: "b" }, { id: "a" }], [{ id: "a" }, { id: "c" }]];
  expect(uniqueProducts(batches).map(p => p.id)).toEqual(["b", "a", "c"]);
  expect(uniqueProducts(batches).map(p => p.id)).toEqual(["b", "a", "c"]);
});
test("file-capable share includes exact primary image bytes, title and canonical link", async () => {
  let fetched = ""; let shared: ShareData | undefined;
  const api = { canShare: ({ files }: ShareData) => files?.length === 1, share: async (data: ShareData) => { shared = data; }, clipboard: { writeText: async () => {} } } as Pick<Navigator, "share" | "canShare" | "clipboard">;
  const fetchImage = (async (url: string) => { fetched = url; return new Response(new Blob(["primary-image-bytes"], { type: "image/jpeg" })); }) as typeof fetch;
  expect(await shareProduct(product, api, fetchImage)).toBe("image");
  expect(fetched).toBe("https://images.example/one.jpg");
  expect(shared?.url).toBe("https://derdalax.co.mz/produto/one");
  expect(shared?.title).toBe("Camisa azul");
  expect(await shared?.files?.[0]?.text()).toBe("primary-image-bytes");
});
test("unsupported image files fall back to canonical link", async () => {
  let shared: ShareData | undefined;
  const api = { canShare: () => false, share: async (data: ShareData) => { shared = data; }, clipboard: { writeText: async () => {} } } as Pick<Navigator, "share" | "canShare" | "clipboard">;
  const fetchImage = (async () => new Response(new Blob(["image"], { type: "image/jpeg" }))) as typeof fetch;
  expect(await shareProduct(product, api, fetchImage)).toBe("link");
  expect(shared?.files).toBeUndefined();
  expect(shared?.url).toBe("https://derdalax.co.mz/produto/one");
});