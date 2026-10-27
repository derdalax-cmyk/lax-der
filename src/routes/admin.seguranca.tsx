import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listMyAdminPasskeys, removeAdminPasskey, regenerateAdminRecoveryCodes, revokeAllMyAdminSessions,
  beginAdminPasskeyRegistration, finishAdminPasskeyRegistration,
} from "@/lib/admin-security.functions";

export const Route = createFileRoute("/admin/seguranca")({
  head: () => ({ meta: [{ title: "Segurança do administrador · DERDALAX" }, { name: "robots", content: "noindex" }] }),
  component: AdminSecurity,
});

function AdminSecurity() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listMyAdminPasskeys);
  const remove = useServerFn(removeAdminPasskey);
  const regen = useServerFn(regenerateAdminRecoveryCodes);
  const revokeAll = useServerFn(revokeAllMyAdminSessions);
  const beginReg = useServerFn(beginAdminPasskeyRegistration);
  const finishReg = useServerFn(finishAdminPasskeyRegistration);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({ queryKey: ["admin-passkeys"], queryFn: () => list() });

  const handle = async (f: () => Promise<void>) => {
    setBusy(true);
    try { await f(); } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (m.includes("STEP_UP_REQUIRED")) {
        toast.message("Confirme novamente a sua identidade.");
        await qc.invalidateQueries({ queryKey: ["admin-security-status"] });
        navigate({ to: "/admin/verificar", search: { redirect: "/admin/seguranca" } });
      } else toast.error(m);
    } finally { setBusy(false); }
  };
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["admin-passkeys"] }),
    qc.invalidateQueries({ queryKey: ["admin-security-status"] }),
  ]);

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="font-display text-3xl flex items-center gap-2"><KeyRound className="w-7 h-7 text-gold" /> Segurança</h1>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Passkeys registadas</h2>
          <Button size="sm" disabled={busy} className="bg-gold text-ink hover:bg-gold/90" onClick={() => handle(async () => {
            const opts = await beginReg();
            const resp = await startRegistration({ optionsJSON: JSON.parse(opts.optionsJson) });
            await finishReg({ data: { response: resp as never, deviceName: navigator.platform || "Dispositivo" } });
            toast.success("Passkey adicionada"); await refresh();
          })}><Fingerprint className="w-4 h-4 mr-1" /> Adicionar dispositivo</Button>
        </div>
        {data?.passkeys.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma passkey.</p>}
        {data?.passkeys.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-t border-border pt-2 text-sm">
            <Fingerprint className="w-4 h-4 text-gold" />
            <div className="flex-1">
              <div className="font-medium">{p.device_name || "Dispositivo"}</div>
              <div className="text-xs text-muted-foreground">
                Criada {new Date(p.created_at).toLocaleDateString("pt-PT")}
                {p.last_used_at && ` · último uso ${new Date(p.last_used_at).toLocaleString("pt-PT")}`}
              </div>
            </div>
            <button disabled={busy} title="Remover" className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
              onClick={() => handle(async () => { await remove({ data: { id: p.id } }); toast.success("Passkey removida"); await refresh(); })}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Códigos de recuperação</h2>
        <p className="text-sm text-muted-foreground">Restantes: {data?.recoveryCodesLeft ?? 0}. Gerar novos invalida os anteriores.</p>
        {codes && (
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-2">Guarde estes códigos agora — não voltarão a ser mostrados. Cada um funciona uma vez.</p>
            <div className="grid grid-cols-2 gap-1 font-mono text-sm">{codes.map((c) => <span key={c}>{c}</span>)}</div>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => { navigator.clipboard?.writeText(codes.join("\n")); toast.success("Copiados"); }}>Copiar</Button>
          </div>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => handle(async () => {
          const r = await regen(); setCodes(r.codes); await refresh();
        })}>Gerar novos códigos</Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <h2 className="font-semibold">Sessões administrativas</h2>
        <Button size="sm" variant="outline" disabled={busy} className="text-destructive" onClick={() => handle(async () => {
          await revokeAll(); toast.success("Sessões revogadas"); await refresh();
        })}><LogOut className="w-4 h-4 mr-1" /> Revogar todas as sessões</Button>
      </div>
    </div>
  );
}
