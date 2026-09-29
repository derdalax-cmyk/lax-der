import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";
import { ensureServiceWorker, SW_URL } from "@/lib/serviceWorker";

export type PushStatus = "unsupported" | "denied" | "granted" | "default" | "loading";
export type PushErrorStage = "unsupported" | "auth" | "permission" | "service_worker" | "subscription" | "database";

export class PushError extends Error {
  stage: PushErrorStage;
  constructor(stage: PushErrorStage, message: string) {
    super(message);
    this.stage = stage;
    this.name = "PushError";
  }
}

export const PUSH_ERROR_MESSAGES: Record<PushErrorStage, string> = {
  unsupported: "Este dispositivo ou navegador não suporta notificações.",
  auth: "Inicie sessão para ativar as notificações.",
  permission:
    "As notificações estão bloqueadas. Ative-as nas definições do Android (Definições → Apps → DERDALAX → Notificações) e tente novamente.",
  service_worker: "Não foi possível preparar o serviço de notificações. Recarregue a app e tente novamente.",
  subscription: "Não foi possível registar este dispositivo para notificações. Tente novamente.",
  database: "Não foi possível guardar a subscrição de notificações. Verifique a ligação e tente novamente.",
};

export function pushErrorMessage(e: unknown): string {
  if (e instanceof PushError) return PUSH_ERROR_MESSAGES[e.stage];
  return "Não foi possível ativar as notificações.";
}

function isSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return (await navigator.serviceWorker.getRegistration(SW_URL)) ?? (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupported()) {
      setStatus("unsupported");
      return;
    }
    const perm = Notification.permission as PushStatus;
    setStatus(perm);
    if (perm !== "granted") {
      setSubscribed(false);
      return;
    }
    const reg = await getRegistration();
    try {
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (typeof document === "undefined") return;
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  /** Must be called directly from a user click handler. */
  const subscribe = useCallback(async () => {
    if (!isSupported()) throw new PushError("unsupported", "Push API unavailable");
    if (!user?.id) throw new PushError("auth", "No session");

    // Never re-prompt once the user has denied permission.
    if (Notification.permission === "denied") {
      setStatus("denied");
      throw new PushError("permission", "Permission denied");
    }

    setBusy(true);
    try {
      // Request permission first, synchronously within the user gesture.
      let permission: NotificationPermission = Notification.permission;
      if (permission !== "granted") {
        try {
          permission = await Notification.requestPermission();
        } catch (e) {
          console.warn("[push] permission request failed", (e as Error)?.name);
          throw new PushError("permission", "requestPermission failed");
        }
      }
      setStatus(permission as PushStatus);
      if (permission !== "granted") {
        if (permission === "denied") throw new PushError("permission", "Permission denied");
        return false; // dismissed ("default") — user can try again
      }

      let reg: ServiceWorkerRegistration;
      try {
        const r = await ensureServiceWorker();
        if (!r) throw new Error("no registration");
        await navigator.serviceWorker.ready;
        reg = (await getRegistration()) ?? r;
      } catch (e) {
        console.warn("[push] service worker failed", (e as Error)?.message);
        throw new PushError("service_worker", "SW unavailable");
      }

      let sub: PushSubscription | null;
      try {
        sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
          });
        }
      } catch (e) {
        console.warn("[push] subscription failed", (e as Error)?.name, (e as Error)?.message);
        throw new PushError("subscription", "subscribe failed");
      }

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        console.warn("[push] subscription missing endpoint/keys");
        throw new PushError("subscription", "invalid subscription");
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" },
      );
      if (error) {
        console.warn("[push] saving subscription failed", error.code);
        throw new PushError("database", "upsert failed");
      }

      setSubscribed(true);
      return true;
    } finally {
      setBusy(false);
    }
  }, [user?.id]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await getRegistration();
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
    subscribed: subscribed && status === "granted",
    busy,
    supported: status !== "unsupported",
    subscribe,
    unsubscribe,
    refresh,
  };
}
