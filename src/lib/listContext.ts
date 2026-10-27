// Product list context snapshots: anchor-based restoration (productId + viewport offset),
// stored per list URL in sessionStorage with TTL/LRU. Only IDs/metadata are stored, never product data.

export type ListSnapshot = {
  key: string;
  anchorProductId: string;
  anchorOffset: number;
  anchorIndex: number;
  scrollY: number;
  ids: string[];
  batches: number;
  ts: number;
  session: string;
};

const STORE = "dx:list-ctx:v1";
const TTL_MS = 30 * 60 * 1000;
const MAX_SNAPSHOTS = 12;
const MAX_IDS = 2000;

export function listContextKey(pathname: string, search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const sorted = [...params.entries()].filter(([, v]) => v !== "" && v !== '""').sort(([a], [b]) => a.localeCompare(b));
  return `${pathname}|${sorted.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

type Store = Record<string, ListSnapshot>;

function read(storage: Storage | undefined, now: number): Store {
  if (!storage) return {};
  try {
    const raw = JSON.parse(storage.getItem(STORE) ?? "{}") as Store;
    return Object.fromEntries(Object.entries(raw).filter(([, s]) => s && now - s.ts < TTL_MS));
  } catch {
    return {};
  }
}

function getStorage(): Storage | undefined {
  try { return typeof window === "undefined" ? undefined : window.sessionStorage; } catch { return undefined; }
}

export function pruneSnapshots(store: Store, now: number): Store {
  return Object.fromEntries(
    Object.entries(store)
      .filter(([, s]) => now - s.ts < TTL_MS)
      .sort(([, a], [, b]) => b.ts - a.ts)
      .slice(0, MAX_SNAPSHOTS),
  );
}

export function saveSnapshot(snapshot: ListSnapshot, storage = getStorage()): void {
  if (!storage) return;
  const now = snapshot.ts;
  const ids = snapshot.ids.length > MAX_IDS ? snapshot.ids.slice(-MAX_IDS) : snapshot.ids;
  const store = pruneSnapshots({ ...read(storage, now), [snapshot.key]: { ...snapshot, ids } }, now);
  try { storage.setItem(STORE, JSON.stringify(store)); } catch { /* quota: ignore */ }
}

export function loadSnapshot(key: string, now = Date.now(), storage = getStorage()): ListSnapshot | null {
  return read(storage, now)[key] ?? null;
}

export function clearSnapshot(key: string, storage = getStorage()): void {
  if (!storage) return;
  const store = read(storage, Date.now());
  delete store[key];
  try { storage.setItem(STORE, JSON.stringify(store)); } catch { /* ignore */ }
}

/** Scroll delta needed so the anchor's top returns to the saved viewport offset. */
export function anchorScrollTarget(currentScrollY: number, anchorTop: number, savedOffset: number): number {
  return Math.max(0, Math.round(currentScrollY + anchorTop - savedOffset));
}

// Lists with incremental batches register a loader so restoration can fetch until the anchor exists.
type Loader = { loadMore: () => Promise<unknown> | void; hasMore: () => boolean; batches: () => number };
const loaders = new Map<string, Loader>();
export function registerListLoader(key: string, loader: Loader): () => void {
  loaders.set(key, loader);
  return () => { if (loaders.get(key) === loader) loaders.delete(key); };
}
export function getListLoader(key: string): Loader | undefined {
  return loaders.get(key);
}

let sessionId = "";
export function listSessionId(): string {
  if (!sessionId) sessionId = `${Date.now().toString(36)}${Math.floor(performance.now()).toString(36)}`;
  return sessionId;
}
