import { useEffect, useState } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePushNotifications, pushErrorMessage, PUSH_ERROR_MESSAGES } from "@/hooks/usePushNotifications";

const DISMISS_KEY = "push-banner-dismissed-at";
const SESSION_KEY = "push-banner-dismissed-session";
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // "Agora não" hides for 3 days

function isDismissed(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return true;
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Visual prompt only — never calls Notification.requestPermission() on its own.
 * The native permission dialog is triggered exclusively by tapping "Ativar".
 */
export function PushNotificationBanner({ floating = false }: { floating?: boolean }) {
  const { status, subscribed, busy, supported, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(isDismissed());
  }, []);

  if (status === "loading" || !supported || subscribed || dismissed) return null;

  const denied = status === "denied";

  const dismiss = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch { /* ignore */ }
    setDismissed(true);
  };

  const enable = async () => {
    try {
      const ok = await subscribe();
      if (ok) toast.success("Notificações ativadas. Vai receber pedidos e mensagens em tempo real.");
    } catch (e) {
      toast.error(pushErrorMessage(e));
    }
  };

  const card = (
    <div className={`${floating ? "shadow-lg bg-background" : "mb-4"} flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 p-3 sm:p-4`}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
        <Bell className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">
          {denied ? "Notificações bloqueadas" : "Ativar notificações do navegador"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {denied
            ? PUSH_ERROR_MESSAGES.permission
            : "Receba avisos de pedidos e mensagens em tempo real, mesmo com o site fechado."}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {!denied && (
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-gold hover:bg-ink/90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
              Ativar
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {denied ? "Entendi" : "Agora não"}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar"
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  if (!floating) return card;
  return (
    <div className="fixed inset-x-3 bottom-24 z-40 md:bottom-6 md:left-auto md:right-6 md:w-96">
      {card}
    </div>
  );
}
