import { Bell, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePushNotifications, pushErrorMessage } from "@/hooks/usePushNotifications";

export function PushSettingsRow() {
  const { status, subscribed, busy, supported, subscribe } = usePushNotifications();

  if (!supported) return null;

  const on = subscribed && status === "granted";

  if (on) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/5 px-3 py-2.5">
        <span className="h-8 w-8 rounded-lg bg-gold/15 text-gold flex items-center justify-center">
          <BellRing className="w-4 h-4" />
        </span>
        <span>
          <span className="block text-sm font-medium leading-tight">Notificações ativas</span>
          <span className="block text-xs text-muted-foreground mt-0.5">Receberá pedidos e mensagens em tempo real.</span>
        </span>
      </div>
    );
  }

  const enable = async () => {
    try {
      const ok = await subscribe();
      if (ok) toast.success("Notificações ativadas.");
    } catch (e) {
      toast.error(pushErrorMessage(e));
    }
  };

  return (
    <button
      type="button"
      onClick={enable}
      disabled={busy}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 hover:border-gold/60 transition-colors disabled:opacity-60"
    >
      <span className="flex items-center gap-3 text-left">
        <span className="h-8 w-8 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
        </span>
        <span>
          <span className="block text-sm font-medium leading-tight">Notificações do navegador</span>
          <span className="block text-xs text-muted-foreground mt-0.5">Receba pedidos e mensagens mesmo com o site fechado.</span>
        </span>
      </span>
      <span className="text-xs font-semibold rounded-full px-3 py-1 bg-gold text-ink shrink-0">Permitir</span>
    </button>
  );
}
