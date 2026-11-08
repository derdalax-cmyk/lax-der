export const SW_URL = "/sw.js";
import { refuseOfflineRegistration } from "./offlineCachePolicy";

let pending: Promise<ServiceWorkerRegistration | null> | null = null;

function canUseSW() {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

/**
 * Registers /sw.js once per page load, for ANY visitor (logged in or not).
 * Push notifications reuse the same registration instead of registering again.
 */
export function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseSW()) return Promise.resolve(null);
  if (!pending) {
    pending = (async () => {
      try {
        const refused = refuseOfflineRegistration(window.location.hostname, import.meta.env.PROD, window.self !== window.top, new URLSearchParams(window.location.search).get("sw") === "off");
        if (refused) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            const url = reg.active?.scriptURL ?? reg.waiting?.scriptURL ?? reg.installing?.scriptURL;
            if (url && new URL(url).pathname === SW_URL) await reg.unregister();
          }
          // Messaging remains available independently in previews, without any offline cache.
          return await navigator.serviceWorker.register("/push-events.js", { scope: "/" });
        }
        const existing = await navigator.serviceWorker.getRegistration(SW_URL);
        if (existing && existing.active?.scriptURL.endsWith(SW_URL)) {
          void existing.update().catch(() => {});
          return existing;
        }
        return await navigator.serviceWorker.register(SW_URL, { scope: "/" });
      } catch (e) {
        pending = null;
        console.warn("Service worker registration failed", e);
        return null;
      }
    })();
  }
  return pending;
}

/**
 * Re-checks the registration after the app comes back from the background
 * (tab restored, PWA resumed from the app switcher, page restored from the
 * back/forward cache). Mobile browsers can evict or unregister the worker
 * while the app is frozen, which silently breaks offline + push.
 */
export function revalidateServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseSW()) return Promise.resolve(null);
  pending = null;
  return ensureServiceWorker().then(async (reg) => {
    if (reg) {
      try {
        await reg.update();
      } catch {
        /* offline or update blocked — keep the existing worker */
      }
    }
    return reg;
  });
}

/** Wires the resume/visibility listeners. Returns a cleanup function. */
export function watchServiceWorker(): () => void {
  if (!canUseSW()) return () => {};

  const onVisible = () => {
    if (document.visibilityState === "visible") void revalidateServiceWorker();
  };
  const onPageShow = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) void revalidateServiceWorker();
  };
  const onControllerChange = () => {
    pending = null;
  };

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("focus", onVisible);
  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("focus", onVisible);
    navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  };
}
