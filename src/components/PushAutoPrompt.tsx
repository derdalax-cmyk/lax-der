import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";

/**
 * Silently prompts the browser for push permission a few seconds after
 * an authenticated session is available. Runs at most once per account
 * (tracked in localStorage), regardless of the outcome, so we never
 * nag on every reload. The visible banner in the seller dashboard and
 * the toggle in the profile remain as reinforcement paths.
 */
export function PushAutoPrompt() {
  const { user, loading } = useAuth();
  const { supported, status, subscribed, subscribe } = usePushNotifications();
  const askedRef = useRef(false);

  useEffect(() => {
    if (loading || !user || !supported || askedRef.current) return;
    if (subscribed) return;
    if (status !== "default") return; // don't re-ask if denied or granted

    const key = `push-auto-asked-${user.id}`;
    try {
      if (localStorage.getItem(key) === "1") return;
    } catch {
      return;
    }

    askedRef.current = true;
    const t = window.setTimeout(async () => {
      try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
      try { await subscribe(); } catch { /* ignore */ }
    }, 4000);

    return () => window.clearTimeout(t);
  }, [user, loading, supported, status, subscribed, subscribe]);

  return null;
}
