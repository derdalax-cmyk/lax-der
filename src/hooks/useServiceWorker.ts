import { useEffect } from "react";
import { ensureServiceWorker } from "@/lib/serviceWorker";

/** Registers the service worker on app load, regardless of auth state. */
export function useServiceWorker() {
  useEffect(() => {
    void ensureServiceWorker();
  }, []);
}
