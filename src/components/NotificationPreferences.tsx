import { useEffect, useState } from "react";
import { Bell, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";

type Prefs = {
  push_enabled: boolean;
  email_enabled: boolean;
};

const DEFAULT_PREFS: Prefs = { push_enabled: true, email_enabled: true };

function mergePrefs(raw: unknown): Prefs {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // Compat: if the legacy shape (push:{...}, email:{...}) is present, consider the channel enabled
  // if any sub-flag was truthy.
  const legacyChannelOn = (channel: "push" | "email") => {
    const v = src[channel];
    if (v && typeof v === "object") {
      const vals = Object.values(v as Record<string, unknown>);
      if (vals.length > 0) return vals.some((x) => x !== false);
    }
    return undefined;
  };
  return {
    push_enabled:
      typeof src.push_enabled === "boolean"
        ? (src.push_enabled as boolean)
        : legacyChannelOn("push") ?? DEFAULT_PREFS.push_enabled,
    email_enabled:
      typeof src.email_enabled === "boolean"
        ? (src.email_enabled as boolean)
        : legacyChannelOn("email") ?? DEFAULT_PREFS.email_enabled,
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

  const update = async (key: keyof Prefs, value: boolean) => {
    if (!user) return;
    const prev = prefs;
    const next: Prefs = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ notification_preferences: next } as never)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível guardar a preferência.");
      setPrefs(prev);
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
          <div className="text-xs text-muted-foreground mt-0.5">
            Ative ou desative todas as notificações por canal.
          </div>
        </div>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="divide-y divide-border">
        <div className="py-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-muted grid place-items-center shrink-0">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight">Notificações Push</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Alertas em tempo real no seu dispositivo, mesmo com o site fechado.
              </div>
            </div>
          </div>
          <Switch
            checked={prefs.push_enabled}
            onCheckedChange={(v) => update("push_enabled", v)}
          />
        </div>

        <div className="py-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-muted grid place-items-center shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight">Notificações por Email</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Resumo dos eventos importantes (pedidos, cadastros, denúncias, boas-vindas).
              </div>
            </div>
          </div>
          <Switch
            checked={prefs.email_enabled}
            onCheckedChange={(v) => update("email_enabled", v)}
          />
        </div>
      </div>
    </div>
  );
}
