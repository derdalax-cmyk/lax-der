import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, UserPlus, MoreHorizontal, Loader2, PauseCircle, PlayCircle, UserMinus, Flame } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type CollaboratorRow = {
  id: string;
  user_id: string;
  seller_id: string;
  store_name: string;
  role_slug: string;
  role_label: string;
  permissions: string[];
  status: "active" | "suspended" | "removed";
  created_at: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  products_created: number;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-success/15 text-success border-success/30" },
  suspended: { label: "Suspenso", cls: "bg-gold/20 text-ink border-gold/40" },
  removed: { label: "Removido", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

export function CollaboratorStatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, cls: "bg-secondary text-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", meta.cls)}>
      {meta.label}
    </span>
  );
}

export function useCollaboratorRoles() {
  return useQuery({
    queryKey: ["collaborator-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collaborator_roles").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useCollaboratorActions(invalidateKeys: unknown[][]) {
  const qc = useQueryClient();
  const invalidate = () => invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "suspended" | "removed" }) => {
      const { error } = await supabase.rpc("set_collaborator_status", { _id: id, _status: status });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Acesso atualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role, permissions }: { id: string; role: string; permissions?: string[] }) => {
      const { error } = await supabase.rpc("set_collaborator_role", { _id: id, _role_slug: role, _permissions: permissions });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Função atualizada"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });


  return { setStatus, setRole, invalidate };
}

export function CollaboratorActionsMenu({
  row, onStatus, onRole, roles,
}: {
  row: CollaboratorRow;
  onStatus: (status: "active" | "suspended" | "removed") => void;
  onRole: (role: string, permissions?: string[]) => void;
  roles: { slug: string; label: string }[];
}) {
  const hasFeature = (row.permissions ?? []).includes("products.feature");
  const toggleFeature = () => {
    const base = (row.permissions ?? []).filter((p) => p !== "products.feature");
    onRole(row.role_slug, hasFeature ? base : [...base, "products.feature"]);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações do colaborador">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {row.status !== "active" && (
          <DropdownMenuItem onClick={() => onStatus("active")}>
            <PlayCircle className="w-4 h-4 mr-2" /> Reativar acesso
          </DropdownMenuItem>
        )}
        {row.status === "active" && (
          <DropdownMenuItem onClick={() => onStatus("suspended")}>
            <PauseCircle className="w-4 h-4 mr-2" /> Suspender acesso
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={toggleFeature}>
          <Flame className="w-4 h-4 mr-2" /> {hasFeature ? "Retirar permissão de destaques" : "Permitir candidatar a destaques"}
        </DropdownMenuItem>
        {row.status !== "removed" && (
          <DropdownMenuItem className="text-destructive" onClick={() => onStatus("removed")}>
            <UserMinus className="w-4 h-4 mr-2" /> Remover da loja
          </DropdownMenuItem>
        )}
        {roles.filter((r) => r.slug !== row.role_slug).map((r) => (
          <DropdownMenuItem key={r.slug} onClick={() => onRole(r.slug)}>
            Alterar função para {r.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AddCollaboratorModal({
  sellerId, storeName, open, onOpenChange, onAdded,
}: {
  sellerId: string;
  storeName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdded: () => void;
}) {
  const { data: roles } = useCollaboratorRoles();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("product_manager");
  const [canFeature, setCanFeature] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!email.trim()) { toast.error("Indique o e-mail do colaborador"); return; }
    const base = (roles ?? []).find((r) => r.slug === role)?.default_permissions ?? [];
    const perms = canFeature ? [...base.filter((p) => p !== "products.feature"), "products.feature"] : base;
    setSaving(true);
    const { error } = await supabase.rpc("add_seller_collaborator", {
      _email: email.trim(),
      _seller_id: sellerId,
      _role_slug: role,
      _permissions: canFeature ? perms : undefined,
    });

    setSaving(false);
    if (error) {
      if (error.message.includes("no_account")) toast.error("Não existe conta DERDALAX com esse e-mail. Peça à pessoa para se registar primeiro.");
      else if (error.message.includes("forbidden")) toast.error("Apenas o administrador pode adicionar colaboradores.");
      else toast.error(error.message);
      return;
    }
    toast.success("Colaborador associado à loja");
    setEmail("");
    onOpenChange(false);
    onAdded();
  };

  const selected = (roles ?? []).find((r) => r.slug === role);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar colaborador</DialogTitle>
          <DialogDescription>Associa uma conta DERDALAX existente à loja {storeName}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">E-mail da conta DERDALAX *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@exemplo.com" />
            <p className="text-[11px] text-muted-foreground mt-1">Nenhuma conta nova é criada. A pessoa deve já estar registada.</p>
          </div>
          <div>
            <Label className="text-xs">Função</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(roles ?? []).map((r) => <SelectItem key={r.slug} value={r.slug}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {selected?.description && <p className="text-[11px] text-muted-foreground mt-1">{selected.description}</p>}
          </div>
          {selected && (
            <div className="rounded-xl bg-secondary/50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Permissões</div>
              <div className="flex flex-wrap gap-1.5">
                {selected.default_permissions.map((p) => (
                  <span key={p} className="text-[11px] rounded-full border border-border px-2 py-0.5">{PERM_LABEL[p] ?? p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-gold text-ink hover:bg-gold/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const PERM_LABEL: Record<string, string> = {
  "products.view": "Ver produtos",
  "products.create": "Cadastrar produtos",
  "products.update": "Editar produtos",
  "products.feature": "Candidatar a destaques",
  "seller.view_basic": "Ver dados da loja",
};

export const OPTIONAL_PERMS = ["products.feature"] as const;


export function CollaboratorsSection({ sellerId, storeName }: { sellerId: string; storeName: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const { data: roles } = useCollaboratorRoles();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["seller-collaborators", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_collaborators", { _seller_id: sellerId });
      if (error) throw error;
      return (data ?? []) as unknown as CollaboratorRow[];
    },
  });
  const { setStatus, setRole } = useCollaboratorActions([["seller-collaborators", sellerId], ["admin-team"]]);
  const rows = (data ?? []).filter((r) => r.status !== "removed");

  return (
    <div className="bg-secondary/40 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Colaboradores (só admin)</div>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setAddOpen(true)}>
          <UserPlus className="w-4 h-4" /> Adicionar colaborador
        </Button>
      </div>

      {isLoading ? (
        <div className="py-3 text-sm text-muted-foreground">A carregar…</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-1">
          Nenhum colaborador nesta loja. Adicione membros da equipe para cadastrarem produtos.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.name || r.email || "—"}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {r.email} · {r.role_label} · {r.products_created} produtos cadastrados
                </div>
              </div>
              <CollaboratorStatusPill status={r.status} />
              <CollaboratorActionsMenu
                row={r}
                roles={roles ?? []}
                onStatus={(status) => setStatus.mutate({ id: r.id, status }, { onSuccess: () => refetch() })}
                onRole={(role) => setRole.mutate({ id: r.id, role }, { onSuccess: () => refetch() })}
              />
            </li>
          ))}
        </ul>
      )}

      <AddCollaboratorModal
        sellerId={sellerId}
        storeName={storeName}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => refetch()}
      />
    </div>
  );
}
