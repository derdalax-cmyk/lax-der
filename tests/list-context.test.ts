import { test, expect } from "bun:test";
import { anchorScrollTarget, listContextKey, loadSnapshot, pruneSnapshots, saveSnapshot, type ListSnapshot } from "../src/lib/listContext";

function mem(): Storage {
  const m = new Map<string, string>();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; } } as Storage;
}
const snap = (key: string, ts: number, extra: Partial<ListSnapshot> = {}): ListSnapshot => ({ key, anchorProductId: "p7", anchorOffset: 120, anchorIndex: 7, scrollY: 900, ids: ["p1", "p7"], batches: 5, ts, session: "s", ...extra });

test("each list/filter combination gets its own key, independent of param order", () => {
  expect(listContextKey("/explorar", "?categoria=vestidos&q=azul")).toBe(listContextKey("/explorar", "?q=azul&categoria=vestidos"));
  expect(listContextKey("/explorar", "?categoria=vestidos")).not.toBe(listContextKey("/explorar", "?categoria=saias"));
  expect(listContextKey("/loja/a", "")).not.toBe(listContextKey("/loja/b", ""));
});
test("anchor restores by product offset, not index: new items above only shift the target", () => {
  // Card was 120px from top; after a new product was inserted above, it now sits 420px down.
  expect(anchorScrollTarget(900, 420, 120)).toBe(1200);
  expect(anchorScrollTarget(0, 50, 120)).toBe(0);
});
test("snapshots expire after 30 minutes and missing ones return null", () => {
  const s = mem();
  saveSnapshot(snap("a", 1_000), s);
  expect(loadSnapshot("a", 1_000 + 60_000, s)?.anchorProductId).toBe("p7");
  expect(loadSnapshot("a", 1_000 + 31 * 60_000, s)).toBeNull();
  expect(loadSnapshot("nope", 1_000, s)).toBeNull();
});
test("only the 12 most recent lists are kept and IDs are capped at 2000", () => {
  const store = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, snap(`k${i}`, 1000 + i)]));
  const kept = Object.keys(pruneSnapshots(store, 2000));
  expect(kept.length).toBe(12);
  expect(kept).not.toContain("k0");
  const s = mem();
  saveSnapshot(snap("big", 5, { ids: Array.from({ length: 5000 }, (_, i) => `id${i}`) }), s);
  expect(loadSnapshot("big", 5, s)?.ids.length).toBe(2000);
});
