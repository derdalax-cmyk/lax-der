import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Copy, ImageOff, Store, Check, X } from "lucide-react";
import { ProductFormModal, type ProductRow } from "@/components/admin/ProductFormModal";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/produtos")({
  component: AdminProdutos,
});

type Row = ProductRow & { seller_id: string | null; approval_status: string; rejection_reason: string | null };

const STATUS = ["available", "reserved", "sold"] as const;
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  available: { label: "Disponível", cls: "bg-success/15 text-success" },
  reserved: { label: "Reservado", cls: "bg-gold/20 text-ink" },
  sold: { label: "Vendido", cls: "bg-destructive/15 text-destructive" },
};
const APPROVAL: Record<string, { label: string; cls: string }> = {
  approved: { label: "Aprovado", cls: "bg-success/15 text-success" },
  pending: { label: "Pendente", cls: "bg-gold/20 text-ink" },
  rejected: { label: "Rejeitado", cls: "bg-destructive/15 text-destructive" },
};

type Tab = "all" | "mine" | "sellers" | "pending";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "mine", label: "Meus produtos" },
  { key: "sellers", label: "Produtos dos vendedores" },
  { key: "pending", label: "Pendentes" },
];

function AdminProdutos() {
  const { categories: catList, labelOf } = useCategories();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const { data: sellers } = useQuery({
    queryKey: ["admin-sellers-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sellers").select("id,store_name");
      if (error) throw error;
      return data as { id: string; store_name: string }[];
    },
  });

  const sellerName = useMemo(() => {
    const m = new Map<string, string>();
    (sellers ?? []).forEach((s) => m.set(s.id, s.store_name));
    return m;
  }, [sellers]);

  const counts = useMemo(() => {
    const list = products ?? [];
    return {
      all: list.length,
      mine: list.filter((p) => !p.seller_id).length,
      sellers: list.filter((p) => p.seller_id).length,
      pending: list.filter((p) => p.approval_status === "pending").length,
    };
  }, [products]);

  const filtered = useMemo(() => {
    return (products ?? []).filter((p) => {
      if (tab === "mine" && p.seller_id) return false;
      if (tab === "sellers" && !p.seller_id) return false;
      if (tab === "pending" && p.approval_status !== "pending") return false;
      if (sellerFilter !== "all") {
        if (sellerFilter === "__admin__" && p.seller_id) return false;
        if (sellerFilter !== "__admin__" && p.seller_id !== sellerFilter) return false;
      }
      if (cat !== "all" && p.category !== cat) return false;
      if (status !== "all" && p.status !== status) return false;
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, tab, search, cat, status, sellerFilter]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: ProductRow) => { setEditing(p); setModalOpen(true); };

  const setApproval = async (p: Row, next: "approved" | "rejected") => {
    setBusyId(p.id);
    const { error } = await supabase.from("products").update({ approval_status: next }).eq("id", p.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "approved" ? "Produto aprovado" : "Produto rejeitado");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const duplicate = async (p: Row) => {
    const { data: vars } = await supabase.from("product_variations").select("*").eq("product_id", p.id);
    const { data: copy, error } = await supabase.from("products").insert({
      title: `${p.title} (cópia)`,
      description: p.description,
      base_price: p.base_price,
      category: p.category,
      is_unique: p.is_unique,
      featured: false,
      images: p.images as never,
      status: "available" as const,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    if (vars?.length) {
      await supabase.from("product_variations").insert(vars.map((v) => ({
        product_id: copy.id, size: v.size, color: v.color, stock: v.stock, price: v.price,
      })));
    }
    toast.success("Produto duplicado");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const p = deleteTarget;
    const { data: files } = await supabase.storage.from("products").list(p.id);
    if (files?.length) {
      await supabase.storage.from("products").remove(files.map((f) => `${p.id}/${f.name}`));
    }
    await supabase.from("product_variations").delete().eq("product_id", p.id);
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else toast.success("Produto removido");
    setDeleteTarget(null);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerir o catálogo da loja e dos vendedores.</p>
        </div>
        <Button onClick={openCreate} className="bg-gold text-ink hover:bg-gold/90">
          <Plus className="w-4 h-4 mr-1" /> Novo produto
        </Button>
      </div>

      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              tab === t.key ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-muted-foreground">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome…" className="pl-9" />
        </div>
        <Select value={sellerFilter} onValueChange={setSellerFilter}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vendedores</SelectItem>
            <SelectItem value="__admin__">Loja DERDALAX (admin)</SelectItem>
            {(sellers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {catList.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos estados</SelectItem>
            {STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s].label}</SelectItem>)}
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
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Aprovação</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">A carregar…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
              )}
              {filtered.map((p) => {
                const imgs = Array.isArray(p.images) ? (p.images as string[]) : [];
                const st = STATUS_LABEL[p.status] ?? { label: p.status, cls: "bg-secondary" };
                const ap = APPROVAL[p.approval_status] ?? APPROVAL.approved;
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-secondary/40">
                    <td className="px-4 py-2">
                      <div className="w-12 h-12 rounded-md bg-secondary overflow-hidden flex items-center justify-center">
                        {imgs[0] ? <img src={imgs[0]} alt={p.title} className="w-full h-full object-cover" /> : <ImageOff className="w-5 h-5 text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {p.title}
                      <div className="flex gap-1 mt-0.5">
                        {p.featured && <span className="text-[10px] bg-gold text-ink px-1.5 py-0.5 rounded">Destaque</span>}
                        {p.is_unique && <span className="text-[10px] bg-ink text-white px-1.5 py-0.5 rounded">Única</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {p.seller_id ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Store className="w-3.5 h-3.5" /> {sellerName.get(p.seller_id) ?? "Vendedor"}
                        </span>
                      ) : (
                        <span className="text-xs bg-ink text-gold px-2 py-0.5 rounded">DERDALAX</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{labelOf(p.category)}</td>
                    <td className="px-4 py-2 font-medium">{Number(p.base_price).toLocaleString("pt-PT")} MT</td>
                    <td className="px-4 py-2"><Badge className={ap.cls}>{ap.label}</Badge></td>
                    <td className="px-4 py-2"><Badge className={st.cls}>{st.label}</Badge></td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        {p.approval_status === "pending" && (
                          <>
                            <button onClick={() => setApproval(p, "approved")} disabled={busyId === p.id} className="p-2 hover:bg-success/10 text-success rounded-md" title="Aprovar"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setApproval(p, "rejected")} disabled={busyId === p.id} className="p-2 hover:bg-destructive/10 text-destructive rounded-md" title="Rejeitar"><X className="w-4 h-4" /></button>
                          </>
                        )}
                        <button onClick={() => openEdit(p)} className="p-2 hover:bg-secondary rounded-md" title="Editar"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => duplicate(p)} className="p-2 hover:bg-secondary rounded-md" title="Duplicar"><Copy className="w-4 h-4" /></button>
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

      <ProductFormModal open={modalOpen} onOpenChange={setModalOpen} product={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o produto "{deleteTarget?.title}", as suas variações e todas as imagens associadas. Não pode ser desfeita.
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
