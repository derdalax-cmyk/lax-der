import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleta } from "@/hooks/useRoleta";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RoletaPanel, useCountdownParts } from "./RoletaPanel";

const LOCAL_KEY = "derdalax_roleta_popup_until";

/** Discreet notice of an active reward + first-visit popup while eligible. */
export function RoletaHome() {
  const { user, loading } = useAuth();
  const { campaign, mine, refresh } = useRoleta();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !campaign) return;
    if (!user) {
      const until = Number(localStorage.getItem(LOCAL_KEY) || 0);
      if (Date.now() > until) setOpen(true);
      return;
    }
    if (!mine) return;
    if (mine.current_spin) return;
    if (mine.popup_dismissed_until && new Date(mine.popup_dismissed_until) > new Date()) return;
    setOpen(true);
  }, [loading, user, campaign, mine]);

  const close = (v: boolean) => {
    if (v) return;
    setOpen(false);
    if (user) { if (!mine?.current_spin) supabase.rpc("roleta_dismiss_popup").then(() => refresh()); }
    else localStorage.setItem(LOCAL_KEY, String(Date.now() + 24 * 3600 * 1000));
  };

  const reward = mine?.reward && (mine.reward.status === "ACTIVE" || mine.reward.status === "RESERVED") ? mine.reward : null;

  return (
    <>
      {reward && (
        <div className="max-w-[1400px] mx-auto px-5 pt-4">
          <ActiveRewardCard percent={reward.percent} expiresAt={reward.expires_at} onExpire={refresh} />
        </div>
      )}
      {campaign && (
        <Dialog open={open} onOpenChange={close}>
          <DialogContent onFocusOutside={(e) => e.preventDefault()} className="bg-ink text-white border-gold/50 max-w-md">
            <div className="text-center space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-gold">Roleta DERDALAX</p>
              <DialogTitle className="font-display text-3xl text-white">Ganhe até <span className="text-gold">{campaign.max_percent}%</span> de desconto</DialogTitle>
              <DialogDescription className="text-white/70 text-sm">Desbloqueie com um código de 5 caracteres ou convidando 5 amigos.</DialogDescription>
            </div>
            <div className="[&_label]:text-white [&_.text-muted-foreground]:text-white/60">
              <RoletaPanel />
            </div>
            <Button variant="ghost" onClick={() => close(false)} className="text-white/70 hover:text-white hover:bg-white/10">Agora não</Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ActiveRewardCard({ percent, expiresAt, onExpire }: { percent: number; expiresAt: string | null; onExpire: () => void }) {
  const time = useCountdownParts(expiresAt, onExpire);
  if (!expiresAt || time.expired) return null;
  const units = [
    { value: time.days, label: "Dias" },
    { value: time.hours, label: "Horas" },
    { value: time.minutes, label: "Min" },
    { value: time.seconds, label: "Seg" },
  ];

  return (
    <Link
      to="/perfil/roleta"
      aria-label={`Seu desconto de ${percent}% está ativo. Ver Roleta de Descontos`}
      className="group flex items-center gap-3 sm:gap-5 rounded-2xl border border-gold/50 bg-ink px-3 py-3 sm:px-5 sm:py-4 text-white shadow-sm hover:border-gold transition-colors"
    >
      <span className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/15">
        <Gift className="h-7 w-7 sm:h-8 sm:w-8 text-gold" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <span className="block min-w-0">
          <span className="block text-sm sm:text-base font-semibold leading-tight">
            Seu desconto de <span className="text-gold">{percent}%</span> está ativo!
          </span>
          <span className="block mt-1 text-xs text-white/65">Aproveite, faltam:</span>
        </span>
        <span className="mt-2 grid w-full max-w-[270px] grid-cols-4 gap-1.5 sm:mt-0 sm:w-auto sm:min-w-[260px]" aria-label="Tempo restante">
          {units.map((unit) => (
            <span key={unit.label} className="flex min-w-0 flex-col items-center rounded-lg border border-gold/25 bg-gold/10 px-1.5 py-1.5">
              <span className="text-base sm:text-lg font-bold leading-none tabular-nums text-gold">{String(unit.value).padStart(2, "0")}</span>
              <span className="mt-1 text-[9px] sm:text-[10px] uppercase text-white/55">{unit.label}</span>
            </span>
          ))}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-gold transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}

/** Captures ?ref= links and credits the referral once the visitor has a new account. */
export function RoletaReferralCapture() {
  const { user, loading } = useAuth();
  const { refresh } = useRoleta();
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[a-z0-9]{8}$/i.test(ref)) localStorage.setItem("derdalax_ref", ref.toLowerCase());
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (loading || !user) return;
    const ref = localStorage.getItem("derdalax_ref");
    if (!ref) return;
    supabase.rpc("roleta_claim_referral", { _ref: ref }).then(({ error }) => {
      if (!error) { localStorage.removeItem("derdalax_ref"); refresh(); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);
  return null;
}
