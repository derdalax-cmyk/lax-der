import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Shield } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/administradores")({
  component: AdminAdmins,
});

function AdminAdmins() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const { data: list, isLoading } = useQuery({
    queryKey: ["admin-allowlist"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_allowlist").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error("Email inválido"); return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("grant_admin_by_email", { _email: e });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Acesso concedido");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["admin-allowlist"] });
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const { error } = await supabase.rpc("revoke_admin_by_email", { _email: removeTarget });
    if (error) toast.error(error.message);
    else toast.success("Acesso removido");
    setRemoveTarget(null);
    qc.invalidateQueries({ queryKey: ["admin-allowlist"] });
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-3xl flex items-center gap-2"><Shield className="w-7 h-7 text-gold" /> Administradores</h1>
        <p className="text-sm text-muted-foreground">Emails com acesso ao painel administrativo. Novos emails recebem o papel ao registar-se.</p>
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

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Email</th><th className="px-4 py-3">Adicionado</th><th className="w-16"></th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">A carregar…</td></tr>}
            {!isLoading && list?.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Sem administradores.</td></tr>}
            {list?.map((a) => (
              <tr key={a.email} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{a.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(a.created_at).toLocaleDateString("pt-PT")}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setRemoveTarget(a.email)} className="p-2 text-destructive hover:bg-destructive/10 rounded-md" title="Remover">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso de {removeTarget}?</AlertDialogTitle>
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
