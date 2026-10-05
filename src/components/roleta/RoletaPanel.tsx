import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift, Copy, Loader2, Users, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleta } from "@/hooks/useRoleta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoletaWheel } from "./RoletaWheel";

export function useCountdown(until: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!until) return "";
  const ms = Math.max(0, new Date(until).getTime() - now);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${d > 0 ? `${d}d ` : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo", RESERVED: "Reservado num pedido", REDEEMED: "Utilizado", EXPIRED: "Expirado", LOST: "Não ganhou",
};

export function RoletaCountdown({ until }: { until: string | null }) {
  const c = useCountdown(until);
  return <span className="tabular-nums">{c}</span>;
}

export function RoletaPanel({ onSpun }: { onSpun?: () => void }) {
  const { user } = useAuth();
  const { campaign, mine, refresh } = useRoleta();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  if (!campaign && !mine?.reward) return <p className="text-sm text-muted-foreground">Não existe nenhuma campanha da Roleta ativa neste momento.</p>;

  if (!user) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-white/80">Inicie sessão ou crie conta para desbloquear a roleta com um código ou com 5 indicações.</p>
        <div className="flex gap-2 justify-center">
          <Button asChild className="bg-gold text-ink hover:bg-gold/90"><Link to="/login" search={{ redirect: "/perfil/roleta" }}>Entrar</Link></Button>
          <Button asChild variant="outline" className="border-gold/60 text-gold bg-transparent hover:bg-gold/10"><Link to="/login" search={{ redirect: "/perfil/roleta", mode: "signup" }}>Criar conta</Link></Button>
        </div>
      </div>
    );
  }

  const spin = async (c: string) => {
    const v = c.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(v)) { toast.error("O código tem 5 letras ou números"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("roleta_spin", { _code: v });
    if (error) { setBusy(false); toast.error(error.message); return; }
    setResult(Number((data as { percent: number }).percent));
  };

  const done = () => { setBusy(false); setRevealed(true); refresh(); onSpun?.(); };

  const genCode = async () => {
    setGenBusy(true);
    const { data, error } = await supabase.rpc("roleta_generate_referral_code");
    setGenBusy(false);
    if (error) { toast.error(error.message); return; }
    setCode(String(data));
    refresh();
  };

  const spinRec = mine?.current_spin;
  const ref = mine?.referral;
  const link = ref && typeof window !== "undefined" ? `${window.location.origin}/?ref=${ref.ref_code}` : "";

  // Spinning or just revealed
  if (result !== null) {
    return (
      <div className="space-y-4 text-center">
        <RoletaWheel prizes={campaign?.prizes ?? []} result={result} spinning={busy} onDone={done} />
        {revealed && (result > 0
          ? <p className="font-display text-2xl text-gold">Ganhou {result}% de desconto! 🎉</p>
          : <p className="font-display text-xl">Não foi desta vez.</p>)}
      </div>
    );
  }

  if (spinRec) {
    return <SpinResult spin={spinRec} />;
  }
  if (!campaign) return mine?.reward ? <SpinResult spin={mine.reward} /> : null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium">Código de desbloqueio</label>
        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))} placeholder="XXXXX" maxLength={5}
            className="uppercase tracking-[0.4em] font-semibold text-center text-foreground bg-background" />
          <Button disabled={busy || code.length !== 5} onClick={() => spin(code)} className="bg-gold text-ink hover:bg-gold/90 shrink-0">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Desbloquear Roleta"}
          </Button>
        </div>
      </div>

      {ref && (
        <div className="rounded-xl border border-gold/40 p-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2"><Users className="w-4 h-4 text-gold" /> Convide 5 amigos e desbloqueie seu código</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-gold" style={{ width: `${Math.min(100, (ref.count / ref.needed) * 100)}%` }} /></div>
            <span className="text-sm font-semibold tabular-nums">{Math.min(ref.count, ref.needed)}/{ref.needed}</span>
          </div>
          <div className="flex gap-2">
            <Input readOnly value={link} className="text-xs text-foreground bg-background" />
            <Button variant="outline" size="icon" aria-label="Copiar link" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}><Copy className="w-4 h-4" /></Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button variant="outline" size="icon" aria-label="Partilhar" onClick={() => navigator.share({ title: "DERDALAX", text: "Crie conta na DERDALAX com o meu link", url: link }).catch(() => {})}><Share2 className="w-4 h-4" /></Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Conta apenas quando uma pessoa nova cria conta pelo seu link.</p>
          {ref.count >= ref.needed && (
            ref.code ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg tracking-[0.3em] font-bold text-gold">{ref.code}</span>
                {ref.code_status === "AVAILABLE" && <Button onClick={() => spin(ref.code!)} disabled={busy} className="bg-gold text-ink hover:bg-gold/90">Usar código e girar</Button>}
              </div>
            ) : (
              <Button onClick={genCode} disabled={genBusy} className="bg-gold text-ink hover:bg-gold/90"><Gift className="w-4 h-4 mr-1" /> Gerar meu código</Button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function SpinResult({ spin }: { spin: { percent: number; status: string; expires_at: string | null; max_discount_mt: number } }) {
  if (spin.percent === 0) {
    return <div className="text-center space-y-1"><p className="font-display text-xl">Não ganhou nesta campanha</p><p className="text-sm text-muted-foreground">Fique atento à próxima campanha da Roleta.</p></div>;
  }
  const live = spin.status === "ACTIVE" || spin.status === "RESERVED";
  return (
    <div className="text-center space-y-2">
      <p className="font-display text-3xl text-gold">-{spin.percent}%</p>
      <p className="text-sm">Estado: <strong>{STATUS_LABEL[spin.status] ?? spin.status}</strong></p>
      {live && spin.expires_at && <p className="text-sm text-muted-foreground">Expira em <RoletaCountdown until={spin.expires_at} /></p>}
      {live && <p className="text-xs text-muted-foreground">Válido numa compra de produtos participantes · desconto máximo {spin.max_discount_mt} MT.</p>}
      {spin.status === "ACTIVE" && <Button asChild size="sm" className="bg-gold text-ink hover:bg-gold/90"><Link to="/explorar">Ver produtos</Link></Button>}
    </div>
  );
}
