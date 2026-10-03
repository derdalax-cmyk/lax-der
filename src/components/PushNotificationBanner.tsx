import { useEffect, useState } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePushNotifications, pushErrorMessage, PUSH_ERROR_MESSAGES } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";

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

  // Never block the button on "denied": in the TWA the state can be stale,
  // so "Ativar" always retries the system dialog.
  const denied = false;

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
    <div className={`${floating ? "shadow-lg" : "mb-4"} flex items-start gap-3 rounded-xl border border-gold/30 bg-notification-surface p-3 text-notification-foreground sm:p-4`}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
        <Bell className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">
          {denied ? "Notificações bloqueadas" : "Ativar notificações do navegador"}
        </p>
        <p className="mt-0.5 text-xs text-notification-foreground">
          {denied
            ? PUSH_ERROR_MESSAGES.permission
            : "Receba avisos de pedidos e mensagens em tempo real, mesmo com o site fechado."}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {!denied && (
            <Button
              type="button"
              onClick={enable}
              disabled={busy}
              size="sm"
              className="h-auto bg-ink px-3 py-1.5 text-xs text-gold hover:bg-ink/90"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
              Ativar
            </Button>
          )}
          <Button
            type="button"
            onClick={dismiss}
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1.5 text-xs text-notification-foreground hover:bg-secondary hover:text-notification-foreground"
          >
            {denied ? "Entendi" : "Agora não"}
          </Button>
        </div>
      </div>
      <Button
        type="button"
        onClick={dismiss}
        aria-label="Fechar"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-notification-foreground hover:bg-secondary hover:text-notification-foreground"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  if (!floating) return card;
  return (
    <div className="fixed inset-x-3 bottom-24 z-40 md:bottom-6 md:left-auto md:right-6 md:w-96">
      {card}
    </div>
  );
}
