import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";

const SW_URL = "/sw.js";

export type PushStatus = "unsupported" | "denied" | "granted" | "default" | "loading";

export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as PushStatus);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const registerSw = useCallback(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service Worker não suportado");
    const existing = await navigator.serviceWorker.getRegistration(SW_URL);
    if (existing) return existing;
    return navigator.serviceWorker.register(SW_URL, { scope: "/" });
  }, []);

  const subscribe = useCallback(async () => {
    if (!user?.id) throw new Error("Precisa de sessão iniciada");
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setStatus(permission as PushStatus);
      if (permission !== "granted") return false;

      const reg = await registerSw();
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          keys: json.keys,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" },
      );
      if (error) throw error;
      setSubscribed(true);
      return true;
    } finally {
      setBusy(false);
    }
  }, [user?.id, registerSw]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    status,
    subscribed,
    busy,
    supported: status !== "unsupported",
    subscribe,
    unsubscribe,
    refresh,
  };
}
