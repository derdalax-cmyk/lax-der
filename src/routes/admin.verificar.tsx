import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  beginAdminPasskeyAuthentication, finishAdminPasskeyAuthentication,
  beginAdminPasskeyRegistration, finishAdminPasskeyRegistration, verifyAdminRecoveryCode,
} from "@/lib/admin-security.functions";
import { useAdminSecurityStatus } from "./admin";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/admin/verificar")({
  validateSearch: (s: Record<string, unknown>) => {
    const r = typeof s.redirect === "string" ? s.redirect : "";
    return { redirect: /^\/admin(\/[A-Za-z0-9/_-]*)?$/.test(r) && !r.startsWith("/admin/verificar") ? r : "/admin" };
  },
  head: () => ({ meta: [{ title: "Verificação de administrador · DERDALAX" }, { name: "robots", content: "noindex" }] }),
  component: VerifyAdmin,
});

function errMsg(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("RECENT_LOGIN_REQUIRED")) return "Para registar a primeira passkey, termine sessão e entre novamente (há menos de 15 min).";
  if (m.includes("NotAllowedError") || m.includes("not allowed")) return "Operação cancelada ou não permitida neste dispositivo.";
  return m || "Falha na verificação.";
}

function VerifyAdmin() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const { data: st } = useAdminSecurityStatus();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const beginAuth = useServerFn(beginAdminPasskeyAuthentication);
  const finishAuth = useServerFn(finishAdminPasskeyAuthentication);
  const beginReg = useServerFn(beginAdminPasskeyRegistration);
  const finishReg = useServerFn(finishAdminPasskeyRegistration);
  const recovery = useServerFn(verifyAdminRecoveryCode);

  const done = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-security-status"] });
    toast.success("Verificação concluída");
    navigate({ to: redirect as "/admin", replace: true });
  };

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try { await f(); await done(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const withPasskey = () => run(async () => {
    const opts = await beginAuth();
    const resp = await startAuthentication({ optionsJSON: opts as never });
    await finishAuth({ data: { response: resp as never } });
  });
  const register = () => run(async () => {
    const opts = await beginReg();
    const resp = await startRegistration({ optionsJSON: opts as never });
    await finishReg({ data: { response: resp as never, deviceName: navigator.platform || "Dispositivo" } });
  });
  const withCode = () => run(async () => { await recovery({ data: { code } }); });

  if (!st || !st.isAdmin) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="text-center space-y-2">
        <ShieldCheck className="w-10 h-10 text-gold mx-auto" />
        <h1 className="font-display text-2xl">Verificação de administrador</h1>
        <p className="text-sm text-muted-foreground">
          {st.canBootstrap
            ? "Registe uma passkey (impressão digital, rosto ou PIN do dispositivo) para proteger o painel."
            : "Confirme a sua identidade para aceder ao painel administrativo."}
        </p>
      </div>

      {st.canBootstrap ? (
        <Button onClick={register} disabled={busy} className="w-full bg-gold text-ink hover:bg-gold/90">
          <Fingerprint className="w-4 h-4 mr-2" /> Registar passkey
        </Button>
      ) : (
        <>
          {st.hasPasskey && (
            <Button onClick={withPasskey} disabled={busy} className="w-full bg-gold text-ink hover:bg-gold/90">
              <Fingerprint className="w-4 h-4 mr-2" /> Verificar com passkey
            </Button>
          )}
          {st.hasRecoveryCodes && (showCode ? (
            <div className="space-y-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX" autoComplete="one-time-code" />
              <Button onClick={withCode} disabled={busy || code.length < 15} variant="outline" className="w-full">Usar código de recuperação</Button>
            </div>
          ) : (
            <button onClick={() => setShowCode(true)} className="w-full text-xs text-muted-foreground underline flex items-center justify-center gap-1">
              <KeyRound className="w-3 h-3" /> Usar código de recuperação
            </button>
          ))}
        </>
      )}
      <button onClick={() => signOut().then(() => navigate({ to: "/login", replace: true }))} className="w-full text-xs text-muted-foreground">
        Terminar sessão
      </button>
    </div>
  );
}
