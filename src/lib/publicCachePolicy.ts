import type { QueryKey } from "@tanstack/react-query";

export const PUBLIC_CACHE_VERSION = "dx-public-catalog-v2";
export const PUBLIC_FRESH_MS = 30 * 60_000;
export const PUBLIC_MAX_AGE_MS = 24 * 60 * 60_000;
export const PUBLIC_QUERY_LIMIT = 24;
export const PUBLIC_QUERY_BYTES = 750_000;
export const PUBLIC_TOTAL_BYTES = 4_000_000;
export const PUBLIC_MAX_BATCHES = 20;
export const PUBLIC_KEYS = ["product-feed", "home-featured", "home-collections", "public-categories", "public-product-details", "home-banners"] as const;
export function deferCatalogueRefresh(key: QueryKey, scrollY: number, restoring: boolean): boolean {
  return restoring || scrollY > 80 && ["product-feed", "home-featured", "home-collections", "public-seller-products", "home-banners"].includes(String(key[0]));
}

export function isPublicQueryKey(key: QueryKey): boolean {
  if (!PUBLIC_KEYS.includes(key[0] as typeof PUBLIC_KEYS[number])) return false;
  if (["public-categories", "home-banners"].includes(String(key[0])) && key.length !== 1) return false;
  if (["home-featured", "home-collections"].includes(String(key[0])) && (key.length !== 2 || key[1] !== null && typeof key[1] !== "string")) return false;
  if (key[0] === "public-product-details" && (key.length !== 2 || typeof key[1] !== "string")) return false;
  if (key[0] === "product-feed") {
    if (key.length !== 2 || !key[1] || typeof key[1] !== "object") return false;
    if (Object.keys(key[1]).some(k => !["search", "category", "city", "gender", "minPrice", "maxPrice", "explore"].includes(k))) return false;
    const filters = key[1] as Record<string, unknown>;
    if (typeof filters.search !== "string" || typeof filters.category !== "string" || filters.city != null && typeof filters.city !== "string") return false;
    if (filters.explore) {
      if (typeof filters.explore !== "object" || Object.entries(filters.explore).some(([k, v]) => !/^_(q|city|categories|gender|min|max|discount|available|unique|sizes|colors|seller)$/.test(k) || v != null && !["string", "boolean", "number"].includes(typeof v) && !(Array.isArray(v) && v.every(item => typeof item === "string")))) return false;
    }
  }
  // Keys are filters, never arbitrary session/security objects.
  return !/token|authorization|password|session|email|phone|address|user_id/i.test(JSON.stringify(key));
}

export function safePublicImage(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value, "https://derdalax.co.mz");
    return url.protocol === "https:" && !url.username && !url.password && !/\/(sign|private)\//i.test(url.pathname) &&
      ![...url.searchParams.keys()].some(k => /token|sign|credential|authorization|secret|expires/i.test(k));
  } catch { return false; }
}

const CARD = ["id", "title", "base_price", "original_price", "is_unique", "status", "category", "created_at"];
const DETAIL = [...CARD, "description", "shipping_fee", "reserved_until", "seller_id", "city"];
function pick(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  return Object.fromEntries(fields.filter(k => typeof row[k] === "string" || typeof row[k] === "number" || typeof row[k] === "boolean" || row[k] === null).map(k => [k, row[k]]));
}
function product(value: unknown, detail = false): Record<string, unknown> {
  const row = value as Record<string, unknown> | null;
  const images = Array.isArray(row?.images) ? row.images.flatMap<string | Record<string, unknown>>(image => {
    if (safePublicImage(image)) return [image];
    if (image && typeof image === "object" && safePublicImage(image.url)) return [{ ...pick(image, ["width", "height"]), url: image.url }];
    return [];
  }).slice(0, 5) : [];
  return { ...pick(value, detail ? DETAIL : CARD), images };
}

/** Positive field projection on write AND read; key allowlisting alone is insufficient. */
export function projectPublicData(key: QueryKey, data: unknown): unknown {
  const rows = (v: unknown) => Array.isArray(v) ? v.slice(0, 40).filter(p => p && typeof p === "object" && typeof p.id === "string").map(p => product(p)) : [];
  switch (key[0]) {
    case "product-feed": {
      const d = data as { pages?: { rows: unknown[]; nextCursor: unknown }[]; pageParams?: unknown[] };
      if (!Array.isArray(d?.pages) || !Array.isArray(d.pageParams) || d.pages.length !== d.pageParams.length) return undefined;
      const validCursor = (v: unknown) => v === null || !!v && typeof v === "object" && typeof (v as Record<string, unknown>).id === "string" && typeof (v as Record<string, unknown>).created_at === "string";
      if (d.pages.some(p => !p || !Array.isArray(p.rows) || p.rows.length > 40 || !validCursor(p.nextCursor)) || d.pageParams.some(p => !validCursor(p))) return undefined;
      // Keep the exact contiguous prefix and matching server cursors, not arbitrary tail pages.
      const cursor = (v: unknown) => v === null ? null : pick(v, ["created_at", "id"]);
      return { pages: d.pages.slice(0, PUBLIC_MAX_BATCHES).map(p => ({ rows: rows(p.rows), nextCursor: p.nextCursor ? cursor(p.nextCursor) : null })), pageParams: d.pageParams.slice(0, PUBLIC_MAX_BATCHES).map(cursor) };
    }
    case "home-featured": return rows(data);
    case "home-collections": return Array.isArray(data) ? data.slice(0, 40).map(c => ({ ...pick(c, ["id", "slug", "name", "icon"]), products: rows(c.products).slice(0, 20) })) : undefined;
    case "public-categories": return Array.isArray(data) ? data.slice(0, 150).map(c => pick(c, ["id", "slug", "label", "icon", "sort_order"])) : undefined;
    case "home-banners": return Array.isArray(data) ? data.slice(0, 20).filter(c => safePublicImage(c.image_url)).map(c => pick(c, ["id", "title", "image_url", "subtitle", "alt", "link_url", "cta_label"])) : undefined;
    case "public-product-details": {
      const d = data as { product?: unknown; related?: unknown[]; sellerProducts?: unknown[] };
      if (!d || !Array.isArray(d.related) || !Array.isArray(d.sellerProducts) || d.product !== null && (!d.product || typeof d.product !== "object" || typeof (d.product as Record<string, unknown>).id !== "string")) return undefined;
      return d && { product: d.product ? product(d.product, true) : null, related: rows(d.related).slice(0, 5), sellerProducts: rows(d.sellerProducts).slice(0, 5) };
    }
    default: return undefined;
  }
}

export type FeedPage<T> = { rows: T[]; nextCursor: { created_at: string; id: string } | null };
/** Preserve order only within each server page; never move rows across cursor boundaries. */
export function stableFeedData<T extends { id: string }>(old: unknown, incoming: { pages: FeedPage<T>[]; pageParams: unknown[] }) {
  const previous = old as typeof incoming | undefined;
  if (!previous?.pages || !incoming?.pages) return incoming;
  return { ...incoming, pages: incoming.pages.map((p, index) => {
    const oldPage = previous.pages[index];
    if (!oldPage || JSON.stringify(previous.pageParams[index]) !== JSON.stringify(incoming.pageParams[index])) return p;
    const byId = new Map(p.rows.map(row => [row.id, row]));
    const rows: T[] = [];
    for (const row of oldPage.rows) {
      const next = byId.get(row.id);
      if (next) { rows.push(next); byId.delete(row.id); }
    }
    rows.push(...byId.values());
    return { ...p, rows };
  }) };
}

export function catalogueRetry(count: number, error: unknown): boolean {
  const e = error as { status?: number; message?: string };
  if (e?.status && e.status < 500 && e.status !== 408 && e.status !== 429) return false;
  return count < 1 && (!e?.status || e.status >= 500 || e.status === 408 || e.status === 429);
}