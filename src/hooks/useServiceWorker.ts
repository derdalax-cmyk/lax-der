import { useEffect } from "react";
import { ensureServiceWorker, watchServiceWorker } from "@/lib/serviceWorker";

/**
 * Registers the service worker on app load, regardless of auth state, and
 * keeps it alive when the app returns from the background on mobile.
 */
export function useServiceWorker() {
  useEffect(() => {
    void ensureServiceWorker();
    return watchServiceWorker();
  }, []);
}
