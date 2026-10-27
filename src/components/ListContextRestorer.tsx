import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  anchorScrollTarget, getListLoader, listContextKey, listSessionId, loadSnapshot, saveSnapshot,
} from "@/lib/listContext";

const MAX_WAIT_MS = 8000;
const SETTLE_MS = 1200;

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
      const ids = Array.from(scope.querySelectorAll<HTMLElement>("[data-product-id]"), (el) => el.dataset.productId!).filter(Boolean);
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
    const onPop = () => { popped = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!popped) return;
    popped = false;
    const key = listContextKey(window.location.pathname, window.location.search);
    const snap = loadSnapshot(key);
    if (!snap || !pendingBack.has(key) && snap.session !== listSessionId()) return;
    pendingBack.delete(key);
    return restore(key, snap.anchorProductId, snap.anchorOffset, snap.batches);
  }, [href]);

  return null;
}

let popped = false;
const pendingBack = new Set<string>();

function restore(key: string, anchorId: string, offset: number, savedBatches: number): () => void {
  const start = performance.now();
  let cancelled = false;
  let found: HTMLElement | null = null;
  let settledAt = 0;
  let loading = false;
  let observer: ResizeObserver | null = null;
  const stop = () => {
    cancelled = true;
    observer?.disconnect();
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
  };
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);

  const align = () => {
    if (!found || !found.isConnected) return;
    const top = found.getBoundingClientRect().top;
    if (Math.abs(top - offset) > 1) {
      window.scrollTo({ top: anchorScrollTarget(window.scrollY, top, offset), behavior: "instant" as ScrollBehavior });
      settledAt = performance.now();
    }
  };

  const tick = () => {
    if (cancelled) return;
    const now = performance.now();
    if (now - start > MAX_WAIT_MS) return stop();
    if (!found) {
      found = document.querySelector<HTMLElement>(`[data-product-id="${CSS.escape(anchorId)}"]`);
      if (found) {
        settledAt = now;
        // Masonry images settle after load: re-align whenever the list layout changes.
        observer = new ResizeObserver(() => requestAnimationFrame(align));
        observer.observe(found.parentElement ?? found);
        observer.observe(document.body);
      } else {
        const loader = getListLoader(key);
        if (loader && !loading && loader.hasMore() && loader.batches() < Math.max(savedBatches, 1) + 3) {
          loading = true;
          void Promise.resolve(loader.loadMore()).finally(() => { loading = false; });
        }
      }
    }
    if (found) {
      align();
      if (now - settledAt > SETTLE_MS) return stop();
    }
    requestAnimationFrame(() => requestAnimationFrame(tick));
  };
  requestAnimationFrame(() => requestAnimationFrame(tick));
  return () => { if (!cancelled) stop(); };
}

