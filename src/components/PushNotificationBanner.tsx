import { useEffect, useState } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePushNotifications, pushErrorMessage } from "@/hooks/usePushNotifications";

const DISMISS_KEY = "push-banner-dismissed";

export function PushNotificationBanner() {
  const { status, subscribed, busy, supported, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  if (!supported || subscribed || status === "denied" || dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
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

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 p-3 sm:p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
        <Bell className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">Ativar notificações do navegador</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Receba avisos de pedidos e mensagens em tempo real, mesmo com o site fechado.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-gold hover:bg-ink/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
            Ativar
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Agora não
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
}
