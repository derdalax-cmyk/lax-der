import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleta } from "@/hooks/useRoleta";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RoletaPanel, RoletaCountdown } from "./RoletaPanel";

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
          <Link to="/perfil/roleta" className="flex items-center justify-between gap-3 rounded-xl border border-gold/50 bg-ink text-gold px-4 py-2.5 text-sm">
            <span className="flex items-center gap-2"><Gift className="w-4 h-4" /> Tem <strong>-{reward.percent}%</strong> da Roleta {reward.status === "RESERVED" ? "(reservado num pedido)" : ""}</span>
            {reward.expires_at && <span className="text-xs opacity-80">expira em <RoletaCountdown until={reward.expires_at} /></span>}
          </Link>
        </div>
      )}
      {campaign && (
        <Dialog open={open} onOpenChange={close}>
          <DialogContent className="bg-ink text-white border-gold/50 max-w-md">
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
