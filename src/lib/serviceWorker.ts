export const SW_URL = "/sw.js";

let pending: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * Registers /sw.js once per page load, for ANY visitor (logged in or not).
 * Push notifications reuse the same registration instead of registering again.
 */
export function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (!pending) {
    pending = (async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration(SW_URL);
        if (existing) return existing;
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
