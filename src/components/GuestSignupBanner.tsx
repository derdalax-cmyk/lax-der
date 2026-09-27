import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const DISMISSED_AT_KEY = "derdalax-guest-signup-dismissed-at";
const SHOW_DELAY_MS = 3_500;
const DISMISS_INTERVAL_MS = 24 * 60 * 60 * 1_000;

export function GuestSignupBanner() {
  const { user, loading } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading || user) {
      setVisible(false);
      return;
    }

    try {
      const dismissedAt = Number(localStorage.getItem(DISMISSED_AT_KEY));
      if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_INTERVAL_MS) return;
    } catch {
      // If storage is unavailable, the invitation can still be shown.
    }

    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [loading, user]);

  if (!visible || loading || user) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    } catch {
      // Closing still works when storage is unavailable.
    }
  };

  return (
    <aside
      aria-label="Convite para criar conta"
      className="fixed inset-x-4 bottom-5 z-50 mx-auto w-auto max-w-sm border border-border bg-card p-5 shadow-[var(--shadow-elegant)] sm:inset-x-auto sm:right-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-sm font-bold text-gold">DERDALAX</p>
          <h2 className="mt-2 font-display text-xl text-foreground">Crie a sua conta em segundos</h2>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={dismiss} aria-label="Fechar convite" className="-mr-2 -mt-2 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Guarde favoritos, acompanhe pedidos e compre mais rápido da próxima vez.
      </p>
      <div className="mt-4 flex gap-2">
        <Button asChild className="flex-1 bg-gold text-ink hover:bg-gold/90">
          <Link to="/login" search={{ mode: "signup" }}>Criar conta</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link to="/login">Entrar</Link>
        </Button>
      </div>
    </aside>
  );
}