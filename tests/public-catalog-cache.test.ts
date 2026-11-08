import { test, expect } from "bun:test";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { compactPublicCache, configurePublicCatalogue, startPublicCatalogue } from "../src/lib/publicCatalogCache";
import { isPublicQueryKey, projectPublicData, PUBLIC_CACHE_VERSION, PUBLIC_FRESH_MS, PUBLIC_MAX_AGE_MS, PUBLIC_MAX_BATCHES, PUBLIC_QUERY_LIMIT, safePublicImage, stableFeedData, catalogueRetry } from "../src/lib/publicCachePolicy";
import { cachePublicStorageImage, cachePublicNavigation, refuseOfflineRegistration, IMAGE_CACHE_LIMIT } from "../src/lib/offlineCachePolicy";

const key = ["product-feed", { search: "", category: "all", city: null }];
const row = (id: string) => ({ id, title: id, base_price: 85.5, created_at: "2026-11-08T00:00:00Z", images: ["https://cdn.example/a.jpg"], email: "private", reserved_by: "private", access_token: "private" });
const page = (ids: string[]) => ({ rows: ids.map(row), nextCursor: { id: ids.at(-1) ?? "", created_at: "2026-11-08T00:00:00Z" } });
const data = { pages: [page(["a", "b"]), page(["c", "d"])], pageParams: [null, { id: "b", created_at: "2026-11-08T00:00:00Z" }] };

test("only positively allowlisted public queries persist", () => {
  for (const k of ["admin-products", "profile", "seller-products", "messages", "orders", "cart", "admin-passkeys", "notifications", "favorites"]) expect(isPublicQueryKey([k])).toBe(false);
  expect(isPublicQueryKey(["product-feed", { token: "private" }])).toBe(false);
  expect(isPublicQueryKey(["product-feed", { search: "", category: "all", city: null, explore: { _q: undefined, _city: undefined, _discount: false, _categories: ["vestidos"] } }])).toBe(true);
  const c = new QueryClient(); c.setQueryData(key, data); c.setQueryData(["admin-products"], [row("secret")]);
  const saved = compactPublicCache(dehydrate(c));
  expect(saved.queries.length).toBe(1);
  const encoded = JSON.stringify(saved);
  for (const word of ["reserved_by", "access_token", "email", "secret"]) expect(encoded).not.toContain(word);
});
test("same pages, ID order and cursor pairs hydrate on reopening", async () => {
  const a = new QueryClient(); a.setQueryData(key, data);
  const saved = compactPublicCache(dehydrate(a));
  const b = new QueryClient(); configurePublicCatalogue(b);
  await startPublicCatalogue(b, { read: async () => saved, write: async () => {}, remove: async () => {} });
  const got = b.getQueryData<typeof data>(key);
  expect(got?.pages.flatMap(p => p.rows.map(r => r.id))).toEqual(["a", "b", "c", "d"]);
  expect(got?.pageParams).toEqual(data.pageParams);
  expect(got?.pages.map(p => p.nextCursor)).toEqual(data.pages.map(p => p.nextCursor));
});
test("freshness is 30 minutes and persistence expires after 24 hours per query", () => {
  expect(PUBLIC_FRESH_MS).toBe(30 * 60_000); expect(PUBLIC_MAX_AGE_MS).toBe(24 * 60 * 60_000);
  const c = new QueryClient(); c.setQueryData(key, data, { updatedAt: 1000 });
  expect(compactPublicCache(dehydrate(c), 1000 + PUBLIC_FRESH_MS + 1).queries.length).toBe(1);
  expect(compactPublicCache(dehydrate(c), 1000 + PUBLIC_MAX_AGE_MS + 1).queries.length).toBe(0);
});
test("schema version mismatch discards old persistence", async () => {
  let removed = false; const c = new QueryClient();
  await startPublicCatalogue(c, { read: async () => ({ version: "old", queries: [] }), write: async () => {}, remove: async () => { removed = true; } });
  expect(removed).toBe(true); expect(PUBLIC_CACHE_VERSION).toBe("dx-public-catalog-v2");
});
test("denied storage and corrupt cache cannot crash startup", async () => {
  const c = new QueryClient();
  await expect(startPublicCatalogue(c, { read: async () => { throw new Error("quota"); }, write: async () => { throw new Error("quota"); }, remove: async () => { throw new Error("quota"); } })).resolves.toBeUndefined();
  c.setQueryData(key, data); expect(c.getQueryData(key)).toBeDefined();
});
test("persisted prefix is capped at 20 batches and at most 24 query variants", () => {
  const projected = projectPublicData(key, { pages: Array.from({ length: 25 }, () => page(["a"])), pageParams: Array(25).fill(null) }) as typeof data;
  expect(projected.pages.length).toBe(PUBLIC_MAX_BATCHES); expect(projected.pageParams.length).toBe(20);
  const c = new QueryClient(); for (let i = 0; i < 40; i++) c.setQueryData(["home-featured", `city${i}`], [row(`${i}`)]);
  expect(compactPublicCache(dehydrate(c)).queries.length).toBe(PUBLIC_QUERY_LIMIT);
});
test("oversized queries are discarded without breaking smaller public entries", () => {
  const c = new QueryClient(); c.setQueryData(["home-featured", "huge"], [{ ...row("x"), title: "x".repeat(800_000) }]);
  c.setQueryData(["home-featured", "small"], [row("y")]);
  expect(compactPublicCache(dehydrate(c)).queries.map(q => q.queryKey[1])).toEqual(["small"]);
});
test("malformed pages and cursor pairs are rejected", () => {
  expect(projectPublicData(key, { ...data, pageParams: [null] })).toBeUndefined();
  expect(projectPublicData(key, { pages: [null], pageParams: [null] })).toBeUndefined();
});
test("revalidation preserves surviving order, removes deleted IDs and retains fresh server continuation", () => {
  const incoming = { pages: [page(["new", "a"]), page(["d", "c"])], pageParams: data.pageParams };
  const next = stableFeedData(data, incoming);
  expect(next.pages.flatMap(p => p.rows.map(r => r.id))).toEqual(["a", "c", "d", "new"]);
  expect(next.pages.map(p => p.nextCursor)).toEqual(incoming.pages.map(p => p.nextCursor));
  const appended = stableFeedData(next, { ...next, pages: [...next.pages, page(["e", "f"])] });
  expect(appended.pages.flatMap(p => p.rows.map(r => r.id))).toEqual(["a", "c", "d", "new", "e", "f"]);
});
test("signed URLs, URL credentials and sensitive query arguments never persist", () => {
  for (const url of ["https://cdn.example/a.jpg?token=x", "https://cdn.example/storage/v1/object/sign/x", "https://u:p@cdn.example/a.jpg", "https://cdn.example/a.jpg?X-Amz-Signature=x"]) expect(safePublicImage(url)).toBe(false);
});
function imageRequest(path: string, headers?: HeadersInit) {
  const url = new URL(`https://project.supabase.co${path}`);
  const request = new Request(url, { headers }); Object.defineProperty(request, "destination", { value: "image" });
  return { url, request };
}
test("public transformed product images use full URL cache key; signed and API paths are excluded", () => {
  expect(IMAGE_CACHE_LIMIT).toBe(300);
  expect(cachePublicStorageImage(imageRequest("/storage/v1/render/image/public/products/a.jpg?width=500&quality=78&resize=contain"))).toBe(true);
  expect(cachePublicStorageImage(imageRequest("/storage/v1/object/public/products/a.jpg"))).toBe(true);
  for (const path of ["/rest/v1/products", "/auth/v1/token", "/functions/v1/x", "/storage/v1/object/sign/private/a.jpg?token=x", "/storage/v1/object/public/products/a.jpg?token=x", "/storage/v1/object/public/other/a.jpg"]) expect(cachePublicStorageImage(imageRequest(path))).toBe(false);
  expect(cachePublicStorageImage(imageRequest("/storage/v1/object/public/products/a.jpg", { Authorization: "Bearer private" }))).toBe(false);
});
test("private and OAuth navigations never enter shell cache", () => {
  const check = (path: string) => { const url = new URL(`https://derdalax.co.mz${path}`); const request = new Request(url); Object.defineProperty(request, "mode", { value: "navigate" }); return cachePublicNavigation({ url, request, sameOrigin: true }); };
  expect(check("/explorar")).toBe(true);
  for (const path of ["/admin", "/perfil", "/pedido/1", "/mensagens", "/checkout", "/carrinho", "/~oauth", "/api/public/x"]) expect(check(path)).toBe(false);
});
test("preview/dev/iframe/kill switch cannot register app-shell worker", () => {
  for (const host of ["id-preview--a.lovable.app", "preview-2--a.lovable.app", "project--a-dev.lovable.app", "beta.lovable.dev", "x.lovableproject.com"]) expect(refuseOfflineRegistration(host, true, false, false)).toBe(true);
  expect(refuseOfflineRegistration("derdalax.co.mz", true, false, false)).toBe(false);
  expect(refuseOfflineRegistration("derdalax.co.mz", true, true, false)).toBe(true);
  expect(refuseOfflineRegistration("derdalax.co.mz", true, false, true)).toBe(true);
});
test("transient failures retry once; authorization and bad requests never retry", () => {
  expect(catalogueRetry(0, { status: 503 })).toBe(true); expect(catalogueRetry(1, { status: 503 })).toBe(false);
  for (const status of [400, 401, 403, 404]) expect(catalogueRetry(0, { status })).toBe(false);
});