import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift, Copy, Loader2, Users, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleta } from "@/hooks/useRoleta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoletaWheel } from "./RoletaWheel";

export function useCountdownParts(until: string | null | undefined, onExpire?: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const expiresAt = until ? new Date(until).getTime() : 0;
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (nextNow >= expiresAt) onExpireRef.current?.();
    };
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const ms = Math.max(0, expiresAt - now);
  return {
    expired: Boolean(until) && ms === 0,
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
}

export function useCountdown(until: string | null | undefined) {
  const { days: d, hours: h, minutes: m, seconds: s } = useCountdownParts(until);
  if (!until) return "";
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
    const res = data as { ok?: boolean; error?: string; percent?: number };
    if (res && res.ok === false) { setBusy(false); toast.error(res.error || "Código inválido ou já utilizado"); return; }
    setResult(Number(res.percent));
  };

  const done = () => { setBusy(false); setRevealed(true); setCode(""); refresh(); onSpun?.(); };
  const again = () => { setResult(null); setRevealed(false); };

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
  const link = ref ? `https://derdalax.co.mz/?ref=${encodeURIComponent(ref.ref_code)}` : "";

  // Spinning or just revealed
  if (result !== null) {
    return (
      <div className="space-y-4 text-center">
        <RoletaWheel prizes={campaign?.prizes ?? []} result={result} spinning={busy} onDone={done} />
        {revealed && (result > 0
          ? <p className="font-display text-2xl text-gold">Ganhou {result}% de desconto! 🎉</p>
          : <p className="font-display text-xl">Não foi desta vez.</p>)}
        {revealed && campaign && (
          <Button onClick={again} variant="outline" className="border-gold/60 text-gold bg-transparent hover:bg-gold/10">Introduzir outro código</Button>
        )}
      </div>
    );
  }

  if (!campaign) return mine?.reward ? <SpinResult spin={mine.reward} /> : null;
  const live = mine?.reward && (mine.reward.status === "ACTIVE" || mine.reward.status === "RESERVED") ? mine.reward : null;
  const activeCount = mine?.active_rewards?.length ?? 0;

  return (
    <div className="space-y-5">
      {live ? (
        <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-center">
          <SpinResult spin={live} />
          {activeCount > 1 && <p className="mt-1 text-xs text-muted-foreground">Tem {activeCount} prémios ativos. Em cada pedido aplicamos automaticamente o que lhe poupa mais.</p>}
        </div>
      ) : spinRec ? (
        <p className="text-center text-sm text-muted-foreground">{spinRec.percent > 0 ? "O seu último prémio já não está ativo." : "Não foi desta vez."} Tem outro código? Tente novamente.</p>
      ) : null}
      <div className="space-y-2">
        <label className="text-sm font-medium">{spinRec ? "Novo código de desbloqueio" : "Código de desbloqueio"}</label>
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
          <p className="text-sm font-medium flex items-center gap-2"><Users className="w-4 h-4 text-gold" /> Partilhe com 5 amigos e ganhe um novo código</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-gold" style={{ width: `${Math.min(100, (ref.count / ref.needed) * 100)}%` }} /></div>
            <span className="text-sm font-semibold tabular-nums">{Math.min(ref.count, ref.needed)}/{ref.needed}</span>
          </div>
          <div className="flex gap-2">
            <Input readOnly value={link} className="text-xs text-foreground bg-background" />
            <Button variant="outline" size="icon" className="text-ink bg-background" aria-label="Copiar link" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}><Copy className="w-4 h-4 !text-ink" /></Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button variant="outline" size="icon" className="text-ink bg-background" aria-label="Partilhar" onClick={() => navigator.share({ title: "Derdalax", text: "Crie conta na Derdalax com o meu link", url: link }).catch(() => {})}><Share2 className="w-4 h-4 !text-ink" /></Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Conta apenas quando uma pessoa nova cria conta pelo seu link.</p>
          {ref.code && ref.code_status === "AVAILABLE" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg tracking-[0.3em] font-bold text-gold">{ref.code}</span>
              <Button onClick={() => spin(ref.code!)} disabled={busy} className="bg-gold text-ink hover:bg-gold/90">Usar código e girar</Button>
            </div>
          )}
          {ref.count >= ref.needed && (
            <Button onClick={genCode} disabled={genBusy} className="bg-gold text-ink hover:bg-gold/90"><Gift className="w-4 h-4 mr-1" /> Gerar novo código</Button>
          )}
        </div>
      )}
    </div>
  );
}

function SpinResult({ spin }: { spin: { percent: number; status: string; expires_at: string | null; max_discount_mt: number } }) {
  if (spin.percent === 0) {
    return <div className="text-center space-y-1"><p className="font-display text-xl">Não foi desta vez</p><p className="text-sm text-muted-foreground">Com um novo código pode girar novamente.</p></div>;
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
