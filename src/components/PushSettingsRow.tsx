import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushSettingsRow() {
  const { status, subscribed, busy, supported, subscribe, unsubscribe } = usePushNotifications();

  if (!supported) return null;

  const toggle = async () => {
    try {
      if (subscribed) {
        await unsubscribe();
        toast.success("Notificações desativadas.");
      } else {
        const ok = await subscribe();
        if (ok) toast.success("Notificações ativadas.");
        else if (status === "denied") toast.error("Permissão bloqueada nas definições do navegador.");
      }
    } catch {
      toast.error("Não foi possível atualizar.");
    }
  };

  const on = subscribed && status === "granted";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || status === "denied"}
      className="w-full group flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 hover:border-gold/60 transition-colors disabled:opacity-60 mb-3"
    >
      <span className="flex items-center gap-3">
        <span className={`h-10 w-10 rounded-xl flex items-center justify-center ${on ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"}`}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : on ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </span>
        <span className="text-left">
          <span className="block font-medium leading-tight">Notificações do navegador</span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            {status === "denied"
              ? "Bloqueadas nas definições do navegador."
              : on
              ? "Ativas — recebe pedidos e mensagens em tempo real."
              : "Ative para receber avisos mesmo com o site fechado."}
          </span>
        </span>
      </span>
      <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${on ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"}`}>
        {on ? "Ativas" : "Desativadas"}
      </span>
    </button>
  );
}
