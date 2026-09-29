import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCollaboration, can } from "@/hooks/useCollaborations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductFormModal, type ProductRow } from "@/components/admin/ProductFormModal";
import { useCategories } from "@/hooks/useCategories";
import { Plus, Search, Pencil, ImageOff, Store, Loader2, Clock, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { getProductDiscount } from "@/lib/productPrice";

export const Route = createFileRoute("/colaborador/$sellerId")({
  component: CollaboratorStorePanel,
});

type Row = ProductRow & { approval_status: string; rejection_reason: string | null };

const APPROVAL: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  approved: { label: "Aprovado", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  pending: { label: "Em revisão", cls: "bg-gold/15 text-gold", icon: Clock },
  rejected: { label: "Rejeitado", cls: "bg-destructive/15 text-destructive", icon: XCircle },
};

function CollaboratorStorePanel() {
  const { sellerId } = Route.useParams();
  const { collaboration, loading } = useCollaboration(sellerId);
  const { labelOf } = useCategories();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const canCreate = can(collaboration, "products.create");
  const canUpdate = can(collaboration, "products.update");

  const { data: products, isLoading } = useQuery({
    queryKey: ["collab-products", sellerId],
    enabled: !!collaboration && collaboration.status === "active",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("*").eq("seller_id", sellerId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const filtered = useMemo(
    () => (products ?? []).filter((p) => !search || p.title.toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );

  const stats = useMemo(() => {
    const all = products ?? [];
    return {
      total: all.length,
      pending: all.filter((p) => p.approval_status === "pending").length,
      approved: all.filter((p) => p.approval_status === "approved").length,
    };
  }, [products]);

  if (loading) {
    return <div className="min-h-[40vh] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!collaboration || collaboration.status !== "active") {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive grid place-items-center mx-auto mb-5">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="font-display text-2xl mb-2">Acesso não disponível</h1>
        <p className="text-sm text-muted-foreground mb-5">
          {collaboration?.status === "suspended"
            ? "O seu acesso a esta loja está suspenso. Fale com a administração."
            : "Não tem acesso a esta loja."}
        </p>
        <Button asChild variant="outline"><Link to="/colaborador">Voltar</Link></Button>
      </div>
    );
  }

  return (
    <div>
      <Link to="/colaborador" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-4 h-4" /> Minhas responsabilidades
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-secondary overflow-hidden grid place-items-center shrink-0">
            {collaboration.logo_url ? <img src={collaboration.logo_url} alt={collaboration.store_name} className="w-full h-full object-cover" /> : <Store className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div>
            <h1 className="font-display text-2xl leading-tight">{collaboration.store_name}</h1>
            <p className="text-sm text-muted-foreground">{collaboration.role_label}</p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="bg-gold text-ink hover:bg-gold/90">
            <Plus className="w-4 h-4 mr-1" /> Cadastrar produto
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Cadastrados" value={stats.total} />
        <Stat label="Em revisão" value={stats.pending} />
        <Stat label="Aprovados" value={stats.approved} />
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar produto…" className="pl-9" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 w-16">Imagem</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Aprovação</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">A carregar…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto cadastrado ainda.</td></tr>
              )}
              {filtered.map((p) => {
                const imgs = Array.isArray(p.images) ? (p.images as string[]) : [];
                const discount = getProductDiscount(Number(p.base_price), p.original_price);
                const ap = APPROVAL[p.approval_status] ?? APPROVAL.pending;
                const Icon = ap.icon;
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-secondary/40 align-top">
                    <td className="px-4 py-2">
                      <div className="w-12 h-12 rounded-md bg-secondary overflow-hidden flex items-center justify-center">
                        {imgs[0] ? <img src={imgs[0]} alt={p.title} className="w-full h-full object-cover" /> : <ImageOff className="w-5 h-5 text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {p.title}
                      {p.approval_status === "rejected" && p.rejection_reason && (
                        <p className="text-[11px] text-destructive mt-0.5 max-w-[240px]">Motivo: {p.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{labelOf(p.category)}</td>
                    <td className="px-4 py-2 font-medium">
                      <div>{Number(p.base_price).toLocaleString("pt-PT")} MT</div>
                      {discount && <div className="text-xs font-normal text-muted-foreground"><span className="line-through">{discount.originalPrice.toLocaleString("pt-PT")} MT</span> <span className="text-destructive">-{discount.discountPercent}%</span></div>}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full ${ap.cls}`}>
                        <Icon className="w-3 h-3" /> {ap.label}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end">
                        {canUpdate && (
                          <button onClick={() => { setEditing(p); setModalOpen(true); }} className="p-2 hover:bg-secondary rounded-md" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ProductFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        product={editing}
        sellerId={sellerId}
        collaborator
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs uppercase text-muted-foreground tracking-wider mb-1">{label}</div>
      <div className="font-display text-2xl leading-tight">{value}</div>
    </div>
  );
}
