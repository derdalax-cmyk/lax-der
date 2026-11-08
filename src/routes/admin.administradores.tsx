import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Shield, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { listAdministrators, grantAdministrator, revokeAdministrator } from "@/lib/admin-security.functions";
import { useAdminSecurityStatus } from "@/hooks/useAdminSecurityStatus";

export const Route = createFileRoute("/admin/administradores")({
  head: () => ({ meta: [{ title: "Administradores · Derdalax" }, { name: "robots", content: "noindex" }] }),
  component: AdminAdmins,
});

type Target = { id: string; name: string };

function AdminAdmins() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: st } = useAdminSecurityStatus();
  const isSuper = !!st && st.isAdmin && st.isSuperAdmin;
  const listFn = useServerFn(listAdministrators);
  const grantFn = useServerFn(grantAdministrator);
  const revokeFn = useServerFn(revokeAdministrator);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Target | null>(null);

  useEffect(() => { if (st && !isSuper) navigate({ to: "/admin", replace: true }); }, [st, isSuper, navigate]);

  const { data, isLoading } = useQuery({ queryKey: ["admin-administrators"], queryFn: () => listFn(), enabled: isSuper });

  const onErr = async (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    if (m.includes("STEP_UP_REQUIRED")) {
      toast.message("Ação crítica: confirme novamente a sua identidade.");
      await qc.invalidateQueries({ queryKey: ["admin-security-status"] });
      navigate({ to: "/admin/verificar", search: { redirect: "/admin/administradores" } });
    } else if (m.includes("FORBIDDEN")) toast.error("Apenas o Super Admin pode gerir administradores.");
    else toast.error(m);
  };

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("Email inválido"); return; }
    setBusy(true);
    try {
      await grantFn({ data: { email: e } });
      toast.success("Acesso concedido");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin-administrators"] });
    } catch (err) { await onErr(err); } finally { setBusy(false); }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await revokeFn({ data: { userId: removeTarget.id } });
      toast.success("Acesso removido");
      qc.invalidateQueries({ queryKey: ["admin-administrators"] });
    } catch (err) { await onErr(err); }
    setRemoveTarget(null);
  };

  if (!isSuper) return null;
  const list = data?.admins;

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-3xl flex items-center gap-2"><Shield className="w-7 h-7 text-gold" /> Administradores</h1>
        <p className="text-sm text-muted-foreground">Contas com acesso ao painel administrativo. O utilizador precisa de ter conta criada.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-5">
        <label className="text-sm font-medium">Conceder acesso a um email</label>
        <div className="flex gap-2 mt-2">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@dominio.com" />
          <Button onClick={add} disabled={busy} className="bg-gold text-ink hover:bg-gold/90">
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">ID</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Passkey</th><th className="px-4 py-3">Desde</th><th className="w-16"></th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">A carregar…</td></tr>}
            {!isLoading && list?.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Sem administradores.</td></tr>}
            {list?.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{a.name}{a.maskedEmail && <div className="text-xs text-muted-foreground">{a.maskedEmail}</div>}</td>
                <td className="px-4 py-3 font-mono text-xs">{a.maskedId}</td>
                <td className="px-4 py-3">{a.isSuperAdmin ? "Super Admin" : "Admin"}</td>
                <td className="px-4 py-3">{a.hasPasskey ? <Fingerprint className="w-4 h-4 text-gold" /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.createdAt ? new Date(a.createdAt).toLocaleDateString("pt-PT") : "—"}</td>
                <td className="px-4 py-3 text-right">
                  {!a.isSuperAdmin && !a.isSelf && (
                    <button onClick={() => setRemoveTarget({ id: a.id, name: a.name })} className="p-2 text-destructive hover:bg-destructive/10 rounded-md" title="Remover">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso de {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>O utilizador perderá o papel de administrador imediatamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
