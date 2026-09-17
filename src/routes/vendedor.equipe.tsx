import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeller } from "@/hooks/useSeller";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, Loader2, PauseCircle, PlayCircle, History, Package } from "lucide-react";
import { toast } from "sonner";
import { SellerAuditSection } from "@/components/admin/SellerAuditSection";


export const Route = createFileRoute("/vendedor/equipe")({
  head: () => ({
    meta: [
      { title: "Atividades da Equipe · DERDALAX" },
      { name: "description", content: "Acompanhe os funcionários da sua loja e as atividades que realizaram na DERDALAX." },
      { property: "og:title", content: "Atividades da Equipe · DERDALAX" },
      { property: "og:description", content: "Acompanhe os funcionários da sua loja e as suas atividades." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SellerTeamPage,
});

type Activity = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, unknown>;
  created_at: string;
  product_title?: string | null;
};

type Member = {
  id: string;
  user_id: string;
  role_slug: string;
  role_label: string;
  permissions: string[];
  status: "active" | "suspended" | "removed";
  created_at: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  products_created: number;
  recent: Activity[];
};

const dt = (s: string) =>
  new Date(s).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const mzn = (n: unknown) => `${Number(n || 0).toLocaleString("pt-PT")} MT`;

function StatusPill({ status }: { status: Member["status"] }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success",
    suspended: "bg-destructive/15 text-destructive",
    removed: "bg-ink/10 text-muted-foreground",
  };
  const label: Record<string, string> = { active: "Ativo", suspended: "Suspenso", removed: "Removido" };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${map[status]}`}>{label[status]}</span>;
}

/** Human sentence for one log entry. */
function describe(a: Activity): { title: string; detail?: string } {
  const c = (a.changes ?? {}) as Record<string, any>;
  const product = a.product_title || c.product_title || c.title?.to || c.title || "produto";
  if (a.action === "product.create") return { title: `Cadastrou "${product}"` };
  if (a.action === "collaborator.suspend_by_seller") return { title: "Foi suspenso pelo vendedor" };
  if (a.action === "collaborator.reactivate_by_seller") return { title: "Foi reativado pelo vendedor" };
  if (a.action === "collaborator.status") return { title: `Estado alterado pela administração: ${c.status ?? "—"}` };
  if (a.action === "product.update") {
    const parts: string[] = [];
    if (c.base_price?.from !== undefined) parts.push(`Preço: ${mzn(c.base_price.from)} → ${mzn(c.base_price.to)}`);
    if (c.title?.from !== undefined) parts.push(`Nome: "${c.title.from}" → "${c.title.to}"`);
    if (c.stock?.from !== undefined) parts.push(`Quantidade: ${c.stock.from} → ${c.stock.to}`);
    if (c.status?.from !== undefined) parts.push(`Estado: ${c.status.from} → ${c.status.to}`);
    if (c.description) parts.push("Editou a descrição");
    if (c.images) parts.push("Alterou as fotografias");
    return { title: `Editou "${product}"`, detail: parts.join(" · ") || undefined };
  }
  return { title: a.action };
}

function useTeam() {
  const { seller } = useSeller();
  return useQuery({
    queryKey: ["my-team", seller?.id],
    enabled: !!seller?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_team");
      if (error) throw error;
      return (data ?? []) as unknown as Member[];
    },
  });
}

function HistoryDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-team-activity", member?.user_id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_team_activity", { _user_id: member!.user_id });
      if (error) throw error;
      return (data ?? []) as unknown as Activity[];
    },
  });

  return (
    <Dialog open={!!member} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {member?.name || member?.email} — {member?.role_label}
            {member && <StatusPill status={member.status} />}
          </DialogTitle>
          <DialogDescription>Histórico completo de atividades nesta loja.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem atividades registadas.</p>
        ) : (
          <ol className="relative space-y-4 pl-4 border-l border-border">
            {data!.map((a) => {
              const d = describe(a);
              return (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-gold" />
                  <p className="text-xs text-muted-foreground">{dt(a.created_at)}</p>
                  <p className="text-sm font-medium">{d.title}</p>
                  {d.detail && <p className="text-xs text-muted-foreground">{d.detail}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SellerTeamPage() {
  const { seller } = useSeller();
  const { data, isLoading } = useTeam();
  const qc = useQueryClient();
  const [openMember, setOpenMember] = useState<Member | null>(null);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "suspended" }) => {
      const { error } = await supabase.rpc("seller_set_collaborator_status", { _id: id, _status: status });
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(status === "suspended" ? "Funcionário suspenso." : "Funcionário reativado.");
      qc.invalidateQueries({ queryKey: ["my-team", seller?.id] });
    },
    onError: (e: any) => {
      toast.error(String(e?.message ?? "").includes("forbidden") ? "Sem autorização para esta ação." : "Não foi possível concluir a ação.");
    },
  });

  const members = data ?? [];

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Atividades da Equipe</h1>
        <p className="text-sm text-muted-foreground">
          Funcionários associados à loja <strong>{seller?.store_name}</strong> e o que cada um fez.
        </p>
      </div>

      {isLoading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : members.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-4 py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-gold/15 text-gold grid place-items-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <p className="font-medium mb-1">Ainda sem funcionários</p>
          <p className="text-sm text-muted-foreground">
            A associação de funcionários à sua loja é feita pela administração da DERDALAX.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {members.map((m) => (
            <div key={m.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-3">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.name ?? "Funcionário"} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-ink/5 grid place-items-center text-sm font-semibold">
                    {(m.name ?? m.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">{m.name || m.email}</p>
                    <StatusPill status={m.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{m.role_label}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Package className="w-3 h-3" /> {m.products_created} produto(s) cadastrado(s)
                  </p>
                </div>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Últimas atividades</p>
                {m.recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem atividades registadas.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {m.recent.map((a) => {
                      const d = describe(a);
                      return (
                        <li key={a.id} className="text-sm">
                          <span className="text-gold mr-1">•</span>
                          {d.title}
                          {d.detail && <span className="text-muted-foreground"> — {d.detail}</span>}
                          <span className="block text-[11px] text-muted-foreground">{dt(a.created_at)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpenMember(m)}>
                  <History className="w-4 h-4 mr-1" /> Histórico completo
                </Button>
                {m.status === "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: m.id, status: "suspended" })}
                  >
                    <PauseCircle className="w-4 h-4 mr-1" /> Suspender
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: m.id, status: "active" })}
                  >
                    <PlayCircle className="w-4 h-4 mr-1" /> Reativar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {seller?.id && (
        <div className="mt-8">
          <SellerAuditSection sellerId={seller.id} />
        </div>
      )}

      <HistoryDialog member={openMember} onClose={() => setOpenMember(null)} />

    </div>
  );
}
