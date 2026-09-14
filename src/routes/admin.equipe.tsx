import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Inbox, History } from "lucide-react";
import {
  CollaboratorActionsMenu, CollaboratorStatusPill, useCollaboratorActions, useCollaboratorRoles,
  type CollaboratorRow,
} from "@/components/admin/CollaboratorsSection";

export const Route = createFileRoute("/admin/equipe")({
  head: () => ({ meta: [{ title: "Equipe · Admin DERDALAX" }, { name: "description", content: "Gerir colaboradores por loja." }] }),
  component: AdminEquipe,
});

type LogRow = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  seller_id: string | null;
  changes: Record<string, unknown>;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  "product.create": "Cadastrou produto",
  "product.update": "Editou produto",
  "collaborator.add": "Adicionou colaborador",
  "collaborator.status": "Alterou estado de colaborador",
  "collaborator.role": "Alterou função de colaborador",
};

function AdminEquipe() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { data: roles } = useCollaboratorRoles();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-team"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_collaborators", {});
      if (error) throw error;
      return (data ?? []) as unknown as CollaboratorRow[];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["admin-activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs").select("*").order("created_at", { ascending: false }).limit(60);
      if (error) throw error;
      return data as unknown as LogRow[];
    },
  });

  const { setStatus: mutStatus, setRole } = useCollaboratorActions([["admin-team"]]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (q && !`${r.name ?? ""} ${r.email ?? ""} ${r.store_name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, status]);

  const stats = useMemo(() => {
    const all = data ?? [];
    return {
      total: all.filter((r) => r.status !== "removed").length,
      active: all.filter((r) => r.status === "active").length,
      suspended: all.filter((r) => r.status === "suspended").length,
      stores: new Set(all.filter((r) => r.status !== "removed").map((r) => r.seller_id)).size,
    };
  }, [data]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Equipe / Colaboradores</h1>
        <p className="text-sm text-muted-foreground">
          Membros da equipe atribuídos a lojas para cadastrar produtos. Adicione novos na ficha de cada loja em Vendedores.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Colaboradores" value={stats.total} />
        <Stat label="Ativos" value={stats.active} />
        <Stat label="Suspensos" value={stats.suspended} />
        <Stat label="Lojas cobertas" value={stats.stores} />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar pessoa ou loja…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="suspended">Suspensos</SelectItem>
            <SelectItem value="removed">Removidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Pessoa</th>
                <th className="px-4 py-3">Loja</th>
                <th className="px-4 py-3">Função</th>
                <th className="px-4 py-3">Produtos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">A carregar…</td></tr>}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-14 text-center">
                  <Users className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <div className="text-muted-foreground">Nenhum colaborador encontrado.</div>
                </td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <div className="font-medium truncate max-w-[180px]">{r.name || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">{r.store_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.role_label}</td>
                  <td className="px-4 py-3">{r.products_created}</td>
                  <td className="px-4 py-3"><CollaboratorStatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <CollaboratorActionsMenu
                      row={r}
                      roles={roles ?? []}
                      onStatus={(s) => mutStatus.mutate({ id: r.id, status: s }, { onSuccess: () => refetch() })}
                      onRole={(role) => setRole.mutate({ id: r.id, role }, { onSuccess: () => refetch() })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-2xl mb-1 flex items-center gap-2"><History className="w-5 h-5 text-gold" /> Registo de atividades</h2>
        <p className="text-sm text-muted-foreground mb-3">Quem fez o quê, quando e o que mudou.</p>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {(logs ?? []).length === 0 && (
            <div className="px-4 py-10 text-center text-muted-foreground">
              <Inbox className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" /> Sem atividades registadas.
            </div>
          )}
          {(logs ?? []).map((l) => (
            <div key={l.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">{l.actor_email ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-PT")}</div>
              </div>
              <div className="text-sm">{ACTION_LABEL[l.action] ?? l.action}</div>
              <ChangeList changes={l.changes} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChangeList({ changes }: { changes: Record<string, unknown> }) {
  const entries = Object.entries(changes ?? {});
  if (entries.length === 0) return null;
  return (
    <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
      {entries.map(([k, v]) => {
        if (v && typeof v === "object" && "from" in (v as object)) {
          const o = v as { from: unknown; to: unknown };
          return <li key={k}>{k}: <span className="line-through">{String(o.from)}</span> → <span className="text-foreground">{String(o.to)}</span></li>;
        }
        return <li key={k}>{k}: <span className="text-foreground">{String(v)}</span></li>;
      })}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs uppercase text-muted-foreground tracking-wider mb-2">{label}</div>
      <div className="font-display text-2xl leading-tight">{value}</div>
    </div>
  );
}
