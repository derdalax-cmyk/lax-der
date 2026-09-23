import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeller } from "@/hooks/useSeller";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, ImageOff, Clock, CheckCircle2, XCircle, CircleCheck, CircleOff, BadgeCheck } from "lucide-react";
import { ProductFormModal, type ProductRow } from "@/components/admin/ProductFormModal";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";

export const Route = createFileRoute("/vendedor/produtos")({
  component: SellerProdutos,
});

type Row = ProductRow & { approval_status: string; rejection_reason: string | null };

const APPROVAL: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  approved: { label: "Aprovado", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  pending: { label: "Pendente", cls: "bg-gold/15 text-gold", icon: Clock },
  rejected: { label: "Rejeitado", cls: "bg-destructive/15 text-destructive", icon: XCircle },
};

const PRODUCT_STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  available: { label: "Disponível", cls: "bg-success/15 text-success", icon: CircleCheck },
  reserved: { label: "Reservado", cls: "bg-gold/15 text-gold", icon: Clock },
  sold: { label: "Vendido", cls: "bg-destructive/15 text-destructive", icon: BadgeCheck },
  out_of_stock: { label: "Sem stock", cls: "bg-destructive/15 text-destructive", icon: CircleOff },
  inactive: { label: "Inativo", cls: "bg-secondary text-muted-foreground", icon: CircleOff },
};

function SellerProdutos() {
  const { categories: catList, labelOf } = useCategories();
  const { seller } = useSeller();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [appr, setAppr] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["seller-products", seller?.id],
    enabled: !!seller?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("seller_id", seller!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const { data: pendingMap } = useQuery({
    queryKey: ["products-pending-orders", seller?.id],
    enabled: !!seller?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_products_pending_orders");
      const m = new Map<string, number>();
      (data ?? []).forEach((r: { product_id: string; pending_qty: number }) => m.set(r.product_id, Number(r.pending_qty)));
      return m;
    },
  });

  const filtered = useMemo(() => {
    return (products ?? []).filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (appr !== "all" && p.approval_status !== appr) return false;
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, search, cat, appr]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: Row) => { setEditing(p); setModalOpen(true); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const p = deleteTarget;
    const folders = [p.id, ...(seller?.user_id ? [`sellers/${seller.user_id}/${p.id}`] : [])];
    for (const folder of folders) {
      const { data: files } = await supabase.storage.from("products").list(folder);
      if (files?.length) await supabase.storage.from("products").remove(files.map((f) => `${folder}/${f.name}`));
    }
    await supabase.from("product_variations").delete().eq("product_id", p.id);
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else toast.success("Produto removido");
    setDeleteTarget(null);
    qc.invalidateQueries({ queryKey: ["seller-products"] });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Meus produtos</h1>
          <p className="text-sm text-muted-foreground">Gerir os produtos da sua loja.</p>
        </div>
        <Button onClick={openCreate} className="bg-gold text-ink hover:bg-gold/90">
          <Plus className="w-4 h-4 mr-1" /> Novo produto
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome…" className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {catList.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={appr} onValueChange={setAppr}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos estados</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
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
                <th className="px-4 py-3">Disponibilidade</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">A carregar…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
              )}
              {filtered.map((p) => {
                const imgs = Array.isArray(p.images) ? (p.images as string[]) : [];
                const ap = APPROVAL[p.approval_status] ?? APPROVAL.pending;
                const Icon = ap.icon;
                const pendingQty = pendingMap?.get(p.id) ?? 0;
                const productStatus = p.status !== "sold" && pendingQty > 0
                  ? { label: p.is_unique ? "Pendente (pedido)" : `${pendingQty} pendente(s)`, cls: "bg-gold/15 text-gold", icon: Clock }
                  : PRODUCT_STATUS[p.status] ?? PRODUCT_STATUS.available;
                const ProductStatusIcon = productStatus.icon;
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
                    <td className="px-4 py-2 font-medium">{Number(p.base_price).toLocaleString("pt-PT")} MT</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full ${ap.cls}`}>
                        <Icon className="w-3 h-3" /> {ap.label}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full ${productStatus.cls}`}>
                        <ProductStatusIcon className="w-3 h-3" /> {productStatus.label}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-2 hover:bg-secondary rounded-md" title="Editar"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteTarget(p)} className="p-2 hover:bg-destructive/10 text-destructive rounded-md" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ProductFormModal open={modalOpen} onOpenChange={setModalOpen} product={editing} sellerId={seller?.id ?? null} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o produto "{deleteTarget?.title}", as suas variações e imagens. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
