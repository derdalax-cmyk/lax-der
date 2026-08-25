import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2, MailCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAccountDeletionStatus,
  requestAccountDeletionCode,
  confirmAccountDeletion,
} from "@/lib/account-deletion.functions";

type Blocker = { kind: "order" | "seller_order"; reference: string };

type AccountDeletionFlowProps = {
  onDeleted?: () => void;
};

export function AccountDeletionFlow({ onDeleted }: AccountDeletionFlowProps) {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const checkStatus = useServerFn(getAccountDeletionStatus);
  const requestCode = useServerFn(requestAccountDeletionCode);
  const confirmDeletion = useServerFn(confirmAccountDeletion);

  const [understood, setUnderstood] = useState(false);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [checking, setChecking] = useState(true);
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setChecking(true);
    checkStatus()
      .then((res) => {
        if (alive) setBlockers((res.blockers ?? []) as Blocker[]);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [user?.id, checkStatus]);

  const blocked = blockers.length > 0;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await requestCode({});
      if (!res.sent) {
        setBlockers((res.blockers ?? []) as Blocker[]);
        toast.error("Existe uma disputa financeira em aberto na sua conta.");
        return;
      }
      setCodeSent(true);
      setCode("");
      toast.success("Enviámos um código de 6 dígitos para o seu email.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o código.");
    } finally {
      setSending(false);
    }
  };

  const confirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      const res = await confirmDeletion({ data: { code: code.trim() } });
      if (!res.deleted) {
        if (res.error === "blocked") {
          setBlockers((res.blockers ?? []) as Blocker[]);
          setError("Existe uma disputa financeira em aberto. A eliminação está bloqueada.");
        } else if (res.error === "expired") {
          setCodeSent(false);
          setError("O código expirou. Peça um novo código.");
        } else if (res.error === "no_code") {
          setCodeSent(false);
          setError("Não existe um código válido. Peça um novo código.");
        } else if (res.error === "too_many") {
          setCodeSent(false);
          setError("Demasiadas tentativas erradas. Peça um novo código.");
        } else {
          setError(
            res.attemptsLeft != null
              ? `Código incorreto. Restam ${res.attemptsLeft} tentativa(s).`
              : "Código incorreto.",
          );
        }
        return;
      }
      await signOut();
      toast.success("A sua conta foi apagada.");
      onDeleted?.();
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível apagar a conta.");
    } finally {
      setConfirming(false);
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="h-11 w-11 rounded-2xl bg-destructive/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">Excluir conta</h1>
          <p className="text-sm text-muted-foreground mt-1">{profile?.email || user.email}</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-secondary/40 p-4 sm:p-5 text-sm leading-relaxed">
        <p className="font-semibold mb-2">O que acontece quando apaga a conta</p>
        <p className="text-muted-foreground">
          Isso vai apagar permanentemente a sua conta, o seu perfil, endereços salvos, histórico de pedidos visível
          para si, e — se for vendedor — a sua loja e produtos publicados. {" "}
          <span className="font-semibold text-foreground">Esta ação não pode ser desfeita.</span>
        </p>
        <p className="text-muted-foreground mt-3">
          Conforme a nossa {" "}
          <Link to="/politicas/$slug" params={{ slug: "privacidade-dados" }} className="text-gold underline">
            Política de Retenção e Eliminação de Dados
          </Link>
          , alguns registos de transações são mantidos de forma anónima (sem o seu nome nem contactos) por obrigação
          legal, para fins fiscais e antifraude.
        </p>
      </div>

      {checking ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> A verificar a sua conta…
        </div>
      ) : blocked ? (
        <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 sm:p-5 text-sm">
          <p className="font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Eliminação bloqueada
          </p>
          <p className="text-muted-foreground mt-2">
            Existe uma disputa financeira ou pedido em curso associado à sua conta. Segundo a Política de Retenção e
            Eliminação de Dados, não podemos apagar dados relevantes a uma disputa ativa. Conclua ou resolva o(s)
            caso(s) abaixo e volte depois — o suporte pode ajudar.
          </p>
          <ul className="mt-3 space-y-1">
            {blockers.map((b, i) => (
              <li key={`${b.kind}-${b.reference}-${i}`} className="text-foreground">
                • {b.kind === "order" ? "Pedido em curso" : "Venda em curso na sua loja"} #{b.reference}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/suporte">Falar com o suporte</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/perfil/pedidos">Ver os meus pedidos</Link>
            </Button>
          </div>
        </div>
      ) : !codeSent ? (
        <>
          <label className="mt-6 flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={understood}
              onCheckedChange={(v) => setUnderstood(v === true)}
              aria-label="Confirmo que entendo que esta ação é permanente"
            />
            <span className="text-sm leading-snug">Eu entendo que esta ação é permanente e irreversível</span>
          </label>

          <Button
            variant="destructive"
            className="mt-5 w-full sm:w-auto"
            disabled={!understood || sending}
            onClick={send}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> A enviar código…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" /> Apagar permanentemente
              </>
            )}
          </Button>
        </>
      ) : (
        <div className="mt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MailCheck className="w-4 h-4 text-gold" /> Código enviado para {profile?.email || user.email}
          </div>
          <div className="mt-4 max-w-xs">
            <Label className="text-xs">Digite o código de 6 dígitos que enviámos para o seu email</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="tracking-[0.5em] text-center text-lg"
            />
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="destructive" disabled={code.length !== 6 || confirming} onClick={confirm}>
              {confirming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> A apagar…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" /> Confirmar e apagar
                </>
              )}
            </Button>
            <Button variant="ghost" disabled={sending} onClick={send}>
              {sending ? "A reenviar…" : "Reenviar código"}
            </Button>
          </div>
        </div>
      )}

      {!codeSent && !blocked && error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}