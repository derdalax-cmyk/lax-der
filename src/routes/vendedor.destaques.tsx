import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeller } from "@/hooks/useSeller";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Sparkles, Loader2, Plus, Check, Clock, XCircle, CheckCircle2, ImageOff, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vendedor/destaques")({
  component: SellerDestaques,
});

type Submission = { product_id: string; status: string };
type SellerCollection = {
  id: string;
  name: string;
  icon: string | null;
  cover_image: string | null;
  max_products_per_seller: number;
  starts_at: string | null;
  ends_at: string | null;
  submissions: Submission[];
};
type ProductLite = { id: string; title: string; images: unknown };

function firstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0) {
    const f = images[0];
    if (typeof f === "string") return f;
    if (f && typeof f === "object" && "url" in f) return String((f as { url: unknown }).url);
  }
  return null;
}

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  approved: { label: "Aprovado", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  pending: { label: "Pendente", cls: "bg-gold/15 text-gold", icon: Clock },
  rejected: { label: "Rejeitado", cls: "bg-destructive/15 text-destructive", icon: XCircle },
};

function SellerDestaques() {
  const { seller } = useSeller();
  const qc = useQueryClient();
  const [addFor, setAddFor] = useState<SellerCollection | null>(null);

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["seller-featured-collections", seller?.id],
    enabled: !!seller?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_featured_collections");
      if (error) throw error;
      return (data ?? []) as unknown as SellerCollection[];
    },
  });

  const { data: myProducts = [] } = useQuery({
    queryKey: ["seller-approved-products", seller?.id],
    enabled: !!seller?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,title,images")
        .eq("seller_id", seller!.id)
        .eq("approval_status", "approved")
        .order("created_at", { ascending: false });
      return (data ?? []) as ProductLite[];
    },
  });

  const productMap = useMemo(() => new Map(myProducts.map((p) => [p.id, p])), [myProducts]);

  const withdraw = async (collectionId: string, productId: string) => {
    const { error } = await supabase.rpc("withdraw_product_from_collection", {
      _collection_id: collectionId,
      _product_id: productId,
    });
    if (error) return toast.error(error.message);
    toast.success("Produto retirado do destaque");
    qc.invalidateQueries({ queryKey: ["seller-featured-collections", seller?.id] });
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Destaques</h1>
        <p className="text-sm text-muted-foreground">Candidate os seus produtos aos destaques da loja. As candidaturas são aprovadas pela administração.</p>
      </div>

      {isLoading ? (
        <div className="h-56 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : collections.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-4 py-16 text-center text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Não há destaques disponíveis para a sua loja neste momento.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {collections.map((c) => {
            const subs = c.submissions ?? [];
            const activeCount = subs.filter((s) => s.status !== "rejected").length;
            const atLimit = c.max_products_per_seller > 0 && activeCount >= c.max_products_per_seller;
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="h-24 bg-secondary relative">
                  {c.cover_image ? (
                    <img src={c.cover_image} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-3xl">{c.icon || "✨"}</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{c.icon ? `${c.icon} ` : ""}{c.name}</h3>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {c.max_products_per_seller > 0 ? `${activeCount}/${c.max_products_per_seller}` : `${activeCount} produto(s)`}
                    </span>
                  </div>

                  {subs.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {subs.map((s) => {
                        const p = productMap.get(s.product_id);
                        const st = STATUS[s.status] ?? STATUS.pending;
                        const Icon = st.icon;
                        return (
                          <li key={s.product_id} className="flex items-center gap-2 text-sm">
                            <div className="w-8 h-8 rounded bg-secondary overflow-hidden shrink-0 grid place-items-center">
                              {p && firstImage(p.images) ? (
                                <img src={firstImage(p.images)!} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImageOff className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <span className="flex-1 min-w-0 truncate">{p?.title ?? "Produto"}</span>
                            <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full", st.cls)}>
                              <Icon className="w-2.5 h-2.5" /> {st.label}
                            </span>
                            <button
                              onClick={() => withdraw(c.id, s.product_id)}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded"
                              title="Retirar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    disabled={atLimit}
                    onClick={() => setAddFor(c)}
                  >
                    <Plus className="w-4 h-4 mr-1" /> {atLimit ? "Limite atingido" : "Candidatar produtos"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddProductsDialog
        collection={addFor}
        products={myProducts}
        onClose={() => setAddFor(null)}
        onSubmitted={() => qc.invalidateQueries({ queryKey: ["seller-featured-collections", seller?.id] })}
      />
    </div>
  );
}

function AddProductsDialog({
  collection, products, onClose, onSubmitted,
}: {
  collection: SellerCollection | null;
  products: ProductLite[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const alreadyIn = useMemo(
    () => new Set((collection?.submissions ?? []).map((s) => s.product_id)),
    [collection],
  );
  const available = products.filter((p) => !alreadyIn.has(p.id));

  const remaining = collection && collection.max_products_per_seller > 0
    ? collection.max_products_per_seller - (collection.submissions ?? []).filter((s) => s.status !== "rejected").length
    : Infinity;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < remaining) next.add(id);
      else toast.error("Limite de produtos por vendedor atingido para este destaque.");
      return next;
    });
  };

  const submit = async () => {
    if (!collection || selected.size === 0) return;
    setSaving(true);
    const { error } = await supabase.rpc("submit_products_to_collection", {
      _collection_id: collection.id,
      _product_ids: [...selected],
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Produtos candidatados. Aguardam aprovação.");
    setSelected(new Set());
    onSubmitted();
    onClose();
  };

  return (
    <Dialog open={!!collection} onOpenChange={(o) => { if (!o) { setSelected(new Set()); onClose(); } }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Candidatar a {collection?.name}</DialogTitle>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Não tem produtos aprovados disponíveis para candidatar.
          </p>
        ) : (
          <div className="space-y-1.5 py-1">
            {available.map((p) => {
              const checked = selected.has(p.id);
              const img = firstImage(p.images);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-2 py-2 rounded-lg border text-left transition-colors",
                    checked ? "border-gold bg-gold/5" : "border-border hover:bg-secondary",
                  )}
                >
                  <div className="w-9 h-9 rounded bg-secondary overflow-hidden shrink-0 grid place-items-center">
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <ImageOff className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <span className="text-sm flex-1 min-w-0 truncate">{p.title}</span>
                  <span className={cn("w-5 h-5 rounded-full border grid place-items-center shrink-0",
                    checked ? "bg-gold border-gold text-ink" : "border-muted-foreground/40")}>
                    {checked && <Check className="w-3 h-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || selected.size === 0} className="bg-gold text-ink hover:bg-gold/90">
            {saving ? "A enviar…" : `Candidatar (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
