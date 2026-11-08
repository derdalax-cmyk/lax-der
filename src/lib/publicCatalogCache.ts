import { dehydrate, hydrate, hashKey, type DehydratedState, type QueryClient } from "@tanstack/react-query";
import { createStore, get, set, del } from "idb-keyval";
import { isListRestoring } from "./listContext";
import { isPublicQueryKey, projectPublicData, PUBLIC_CACHE_VERSION, PUBLIC_FRESH_MS, PUBLIC_MAX_AGE_MS, PUBLIC_QUERY_LIMIT, PUBLIC_QUERY_BYTES, PUBLIC_TOTAL_BYTES, PUBLIC_KEYS, catalogueRetry } from "./publicCachePolicy";

type Saved = { version: string; queries: DehydratedState["queries"] };
type StorageAdapter = { read: () => Promise<unknown>; write: (value: Saved) => Promise<void>; remove: () => Promise<void> };

export function compactPublicCache(state: DehydratedState, now = Date.now()): Saved {
  let bytes = 0;
  const queries = state.queries.filter(q => isPublicQueryKey(q.queryKey) && q.state.dataUpdatedAt > now - PUBLIC_MAX_AGE_MS && q.state.dataUpdatedAt <= now)
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt).flatMap(q => {
      const data = projectPublicData(q.queryKey, q.state.data);
      if (data === undefined) return [];
      // No query meta, error objects, promises or mutation state are serialized.
      const clean = { queryKey: q.queryKey, queryHash: hashKey(q.queryKey), state: { data, dataUpdatedAt: q.state.dataUpdatedAt, dataUpdateCount: 1, error: null, errorUpdatedAt: 0, errorUpdateCount: 0, fetchFailureCount: 0, fetchFailureReason: null, fetchMeta: null, isInvalidated: q.state.isInvalidated, status: "success" as const, fetchStatus: "idle" as const } };
      const size = JSON.stringify(clean).length * 2;
      if (size > PUBLIC_QUERY_BYTES || bytes + size > PUBLIC_TOTAL_BYTES) return [];
      bytes += size;
      return [clean];
    }).slice(0, PUBLIC_QUERY_LIMIT);
  return { version: PUBLIC_CACHE_VERSION, queries };
}

function browserStorage(): StorageAdapter {
  // Lazy: no browser/IndexedDB access during SSR or module evaluation.
  const store = createStore("derdalax-public-catalog", "cache");
  const slot = "catalog";
  const fallback = "dx:public-catalog";
  return {
    read: async () => {
      try { const value = await get(slot, store); if (value !== undefined) return value; } catch { /* use fallback */ }
        try { return JSON.parse(localStorage.getItem(fallback) ?? "null"); } catch { return undefined; }
    },
    write: async value => {
      try { await set(slot, value, store); try { localStorage.removeItem(fallback); } catch { /* ignore */ } } catch {
        // Quota: prune half the least-recent entries once, then degrade without crashing.
        const smaller = { ...value, queries: value.queries.slice(0, Math.max(1, Math.floor(value.queries.length / 2))) };
        try { await set(slot, smaller, store); } catch {
          try { localStorage.setItem(fallback, JSON.stringify(smaller)); } catch { /* unavailable storage */ }
        }
      }
    },
    remove: async () => { try { await del(slot, store); } catch { /* unavailable */ } try { localStorage.removeItem(fallback); } catch { /* unavailable */ } },
  };
}

export function configurePublicCatalogue(client: QueryClient) {
  for (const key of PUBLIC_KEYS) client.setQueryDefaults([key], { staleTime: PUBLIC_FRESH_MS, gcTime: PUBLIC_MAX_AGE_MS, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false, retry: catalogueRetry, networkMode: "offlineFirst" });
}

const initialized = new WeakMap<QueryClient, Promise<void>>();
export function restorePublicCatalogue(client: QueryClient): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const existing = initialized.get(client);
  if (existing) return existing;
  const ready = startPublicCatalogue(client, browserStorage());
  initialized.set(client, ready);
  return ready;
}

/** Injectable storage keeps quota, corruption and private-key tests independent of a browser. */
export async function startPublicCatalogue(client: QueryClient, storage: StorageAdapter): Promise<void> {
  try {
    const saved = await storage.read() as Saved | undefined;
    if (saved?.version === PUBLIC_CACHE_VERSION && Array.isArray(saved.queries)) {
      const safe = compactPublicCache({ queries: saved.queries, mutations: [] });
      hydrate(client, { mutations: [], queries: safe.queries });
    } else if (saved) await storage.remove();
  } catch { /* corrupt data or denied storage must not block the catalogue */ }
  let writing = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = async () => {
    if (writing) { dirty = true; return; }
    writing = true;
    try { await storage.write(compactPublicCache(dehydrate(client, { shouldDehydrateMutation: () => false, shouldDehydrateQuery: q => isPublicQueryKey(q.queryKey) && q.state.data !== undefined }))); } catch { /* ignore */ }
    finally { writing = false; if (dirty) { dirty = false; void save(); } }
  };
  client.getQueryCache().subscribe(event => {
    if (!isPublicQueryKey(event.query.queryKey)) return;
    if (event.type !== "removed" && (event.type !== "updated" || !["success", "invalidate", "setState"].includes(event.action.type))) return;
    clearTimeout(timer);
    timer = setTimeout(() => void save(), 400);
  });
  if (typeof window === "undefined") return;
  window.addEventListener("pagehide", () => void save());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void save(); else void refresh(); });
  window.addEventListener("online", () => void refresh());

  // Actual writes already invalidate private management keys on success. Bridge ONLY these
  // targeted invalidations to public keys; auth, favourite and notification events never enter.
  client.getQueryCache().subscribe(event => {
    if (event.type !== "updated" || event.action.type !== "invalidate") return;
    const source = event.query.queryKey[0];
    if (!["admin-products", "seller-products", "collab-products", "seller-orders", "admin-categories"].includes(String(source))) return;
    void client.invalidateQueries({ predicate: q => isPublicQueryKey(q.queryKey), refetchType: "none" });
    void client.invalidateQueries({ predicate: q => ["explore-facets", "explore-count", "category-product-counts", "public-seller-products"].includes(String(q.queryKey[0])), refetchType: "none" });
    void refresh();
  });
  let refreshing = false;
  async function refresh() {
    if (refreshing || !navigator.onLine || document.visibilityState === "hidden" || isListRestoringAny()) return;
    refreshing = true;
    try {
      const queries = client.getQueryCache().findAll({ predicate: q => isPublicQueryKey(q.queryKey) && q.getObserversCount() > 0 && q.state.fetchStatus === "idle" && (q.state.isInvalidated || Date.now() - q.state.dataUpdatedAt >= PUBLIC_FRESH_MS) });
      for (const q of queries) {
        if (isListRestoringAny()) break;
        const anchor = q.queryKey[0] === "product-feed" ? [...document.querySelectorAll<HTMLElement>("[data-product-id]")].find(el => el.getBoundingClientRect().bottom > 0) : undefined;
        const detail = anchor ? { id: anchor.dataset.productId, offset: anchor.getBoundingClientRect().top } : null;
        await client.refetchQueries({ queryKey: q.queryKey, exact: true }, { cancelRefetch: false });
        if (detail && !isListRestoringAny()) window.dispatchEvent(new CustomEvent("dx:catalogue-revalidated", { detail }));
      }
    } finally { refreshing = false; }
  }
  // Let hydration, masonry and back-navigation finish before touching persisted rows.
  window.setTimeout(() => void refresh(), 1200);
  window.setInterval(() => void refresh(), 60_000);
}

function isListRestoringAny() { return isListRestoring(document.documentElement.dataset.listRestoring ?? "") && !!document.documentElement.dataset.listRestoring; }