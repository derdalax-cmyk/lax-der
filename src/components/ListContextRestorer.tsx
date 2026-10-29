import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  anchorScrollTarget, catalogueDebug, getListLoader, listContextKey, listSessionId, loadSnapshot, saveSnapshot, setListRestoring,
} from "@/lib/listContext";

const MAX_WAIT_MS = 30000;
const SETTLE_MS = 800;

/** Captures product-card clicks and restores the list around the same product after history back. */
export function ListContextRestorer() {
  const href = useRouterState({ select: (s) => s.location.href });

  // Capture: before navigating to /produto/:id, record the anchor card and list state.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href*="/produto/"]');
      const card = link?.closest<HTMLElement>("[data-product-id]");
      const id = card?.dataset.productId;
      if (!card || !id || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const key = listContextKey(window.location.pathname, window.location.search);
      const scope = card.closest("main") ?? document;
      const ids = Array.from(scope.querySelectorAll<HTMLElement>("[data-product-id]"), (el) => el.dataset.productId ?? "").filter(Boolean);
      saveSnapshot({
        key,
        anchorProductId: id,
        anchorOffset: card.getBoundingClientRect().top,
        anchorIndex: ids.indexOf(id),
        scrollY: window.scrollY,
        ids,
        batches: getListLoader(key)?.batches() ?? 0,
        ts: Date.now(),
        session: listSessionId(),
      });
      pendingBack.add(key);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Restore: only after a history traversal (browser back, gesture, internal history.back()).
  useEffect(() => {
    const onPop = () => { popped = true; setListRestoring(listContextKey(window.location.pathname, window.location.search)); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!popped) return;
    popped = false;
    const key = listContextKey(window.location.pathname, window.location.search);
    const snap = loadSnapshot(key);
    if (!snap || !pendingBack.has(key) && snap.session !== listSessionId()) { setListRestoring(null); return; }
    pendingBack.delete(key);
    return restore(key, snap.anchorProductId, snap.anchorOffset, snap.batches);
  }, [href]);

  return null;
}

let popped = false;
const pendingBack = new Set<string>();

function restore(key: string, anchorId: string, offset: number, savedBatches: number): () => void {
  const start = performance.now();
  setListRestoring(key);
  let cancelled = false;
  let loading = false;
  let frame = 0;
  let stableFrames = 0;
  let previous = "";
  let alignedAt = 0;
  let corrected = false;
  let drift = false;
  const stop = () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    setListRestoring(null);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
  };
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);
  const tick = () => {
    if (cancelled) return;
    const now = performance.now();
    if (now - start > MAX_WAIT_MS) { catalogueDebug("restore-timeout", { anchorId }); stop(); return; }
    const loader = getListLoader(key);
    const found = document.querySelector<HTMLElement>(`[data-product-id="${CSS.escape(anchorId)}"]`);
    if (loader && loader.batches() < Math.max(1, savedBatches) && loader.hasMore()) {
      if (!loading) {
        loading = true;
        void Promise.resolve(loader.loadMore()).finally(() => { loading = false; });
      }
    } else if (found) {
      const grid = found.closest<HTMLElement>("[data-product-masonry]");
      const wrapper = found.closest<HTMLElement>(".product-masonry-item");
      const ready = !grid || wrapper?.dataset.layoutSettled === "true";
      if (!ready && grid && wrapper) {
        for (const item of Array.from(grid.children)) {
          const image = item.querySelector<HTMLElement>('[data-image-ready="false"]');
          if (image && image.dataset.restoreMeasured !== "true") {
            image.dataset.restoreMeasured = "true";
            image.dispatchEvent(new Event("dx:measure-image"));
          }
          if (item === wrapper) break;
        }
      }
      const top = found.getBoundingClientRect().top;
      const absoluteTop = Math.round((top + window.scrollY) * 2) / 2;
      const signature = `${absoluteTop}:${grid?.dataset.layoutVersion ?? ""}:${found.offsetHeight}`;
      stableFrames = ready && signature === previous ? stableFrames + 1 : 0;
      previous = signature;
      if (!alignedAt && ready && stableFrames >= 2) {
        window.scrollTo({ top: anchorScrollTarget(window.scrollY, top, offset), behavior: "instant" });
        alignedAt = now;
        catalogueDebug("restored", { anchorId, offset, batches: loader?.batches() });
      } else if (alignedAt) {
        drift ||= Math.abs(top - offset) > 2;
        if (now - alignedAt >= SETTLE_MS) {
          if (drift && !corrected) {
            corrected = true;
            window.scrollTo({ top: anchorScrollTarget(window.scrollY, top, offset), behavior: "instant" });
            catalogueDebug("restore-correction", { anchorId, delta: top - offset });
          }
          stop(); return;
        }
      }
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return stop;
}
