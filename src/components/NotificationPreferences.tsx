import { useEffect, useState } from "react";
import { Bell, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";

type Channel = "push" | "email";

type Prefs = {
  push: Record<string, boolean>;
  email: Record<string, boolean>;
};

const DEFAULT_PREFS: Prefs = {
  push: { order: true, order_status: true, new_seller: true, message: true, default: true },
  email: { order: true, order_status: true, new_seller: true },
};

const ROWS: { key: string; label: string; description: string; channels: Channel[] }[] = [
  {
    key: "order",
    label: "Novo pedido",
    description: "Quando recebe um pedido na sua loja.",
    channels: ["push", "email"],
  },
  {
    key: "order_status",
    label: "Atualizações do pedido",
    description: "Quando o estado do seu pedido muda (processando, enviado, entregue).",
    channels: ["push", "email"],
  },
  {
    key: "new_seller",
    label: "Novo vendedor",
    description: "Quando um novo vendedor se cadastra (admins).",
    channels: ["push", "email"],
  },
  {
    key: "message",
    label: "Mensagens",
    description: "Novas mensagens no chat.",
    channels: ["push"],
  },
];

function mergePrefs(raw: unknown): Prefs {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<Prefs>;
  return {
    push: { ...DEFAULT_PREFS.push, ...(src.push ?? {}) },
    email: { ...DEFAULT_PREFS.email, ...(src.email ?? {}) },
  };
}

export function NotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", user.id)
        .maybeSingle();
      if (!mounted) return;
      setPrefs(mergePrefs((data as { notification_preferences?: unknown } | null)?.notification_preferences));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [user]);

  const update = async (channel: Channel, key: string, value: boolean) => {
    if (!user) return;
    const next: Prefs = { ...prefs, [channel]: { ...prefs[channel], [key]: value } };
    setPrefs(next);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ notification_preferences: next } as never)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível guardar a preferência.");
      setPrefs(prefs);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar preferências…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-medium leading-tight">Preferências de notificação</div>
          <div className="text-xs text-muted-foreground mt-0.5">Escolha o que quer receber e por onde.</div>
        </div>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="divide-y divide-border">
        {ROWS.map((row) => (
          <div key={row.key} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight">{row.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{row.description}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {row.channels.includes("push") && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Bell className="h-3.5 w-3.5" />
                  <Switch
                    checked={prefs.push[row.key] !== false}
                    onCheckedChange={(v) => update("push", row.key, v)}
                  />
                </label>
              )}
              {row.channels.includes("email") && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <Switch
                    checked={prefs.email[row.key] !== false}
                    onCheckedChange={(v) => update("email", row.key, v)}
                  />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
