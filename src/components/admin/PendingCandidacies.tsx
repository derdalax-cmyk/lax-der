import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Inbox, Loader2, Store } from "lucide-react";
import { toast } from "sonner";

type PendingRow = {
  collection_id: string;
  product_id: string;
  submitted_by: string | null;
  collection_name: string;
  product_title: string;
  product_image: string | null;
  seller_name: string;
};

function firstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0) {
    const f = images[0];
    if (typeof f === "string") return f;
    if (f && typeof f === "object" && "url" in f) return String((f as { url: unknown }).url);
  }
  return null;
}

export function PendingCandidacies() {
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["featured-candidacies"],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("featured_collection_products")
        .select("collection_id,product_id,submitted_by")
        .eq("status", "pending");
      if (!links?.length) return [] as PendingRow[];

      const colIds = [...new Set(links.map((l) => l.collection_id))];
      const prodIds = [...new Set(links.map((l) => l.product_id))];
      const sellerIds = [...new Set(links.map((l) => l.submitted_by).filter(Boolean) as string[])];

      const [{ data: cols }, { data: prods }, { data: sellers }] = await Promise.all([
        supabase.from("featured_collections").select("id,name").in("id", colIds),
        supabase.from("products").select("id,title,images").in("id", prodIds),
        sellerIds.length
          ? supabase.from("sellers").select("id,store_name").in("id", sellerIds)
          : Promise.resolve({ data: [] as { id: string; store_name: string }[] }),
      ]);

      const colMap = new Map((cols ?? []).map((c) => [c.id, c.name]));
      const prodMap = new Map((prods ?? []).map((p) => [p.id, p]));
      const sellerMap = new Map((sellers ?? []).map((s) => [s.id, s.store_name]));

      return links.map((l) => {
        const p = prodMap.get(l.product_id);
        return {
          collection_id: l.collection_id,
          product_id: l.product_id,
          submitted_by: l.submitted_by,
          collection_name: colMap.get(l.collection_id) ?? "—",
          product_title: p?.title ?? "Produto",
          product_image: firstImage(p?.images),
          seller_name: (l.submitted_by && sellerMap.get(l.submitted_by)) || "Vendedor",
        } as PendingRow;
      });
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["featured-candidacies"] });
    qc.invalidateQueries({ queryKey: ["admin-featured-collections"] });
    qc.invalidateQueries({ queryKey: ["home-collections"] });
  };

  const approve = async (r: PendingRow) => {
    const { error } = await supabase
      .from("featured_collection_products")
      .update({ status: "approved" })
      .eq("collection_id", r.collection_id)
      .eq("product_id", r.product_id);
    if (error) return toast.error(error.message);
    toast.success("Candidatura aprovada");
    refresh();
  };

  const reject = async (r: PendingRow) => {
    const { error } = await supabase
      .from("featured_collection_products")
      .update({ status: "rejected" })
      .eq("collection_id", r.collection_id)
      .eq("product_id", r.product_id);
    if (error) return toast.error(error.message);
    toast.success("Candidatura rejeitada");
    refresh();
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Inbox className="w-4 h-4 text-gold" />
        <h2 className="font-semibold text-sm">Candidaturas de vendedores</h2>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} pendente(s)</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-muted-foreground text-sm">Sem candidaturas pendentes.</div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={`${r.collection_id}-${r.product_id}`} className="flex items-center gap-3 px-4 py-3">
              <div className="w-11 h-11 rounded-md bg-secondary overflow-hidden shrink-0">
                {r.product_image && <img src={r.product_image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.product_title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Store className="w-3 h-3" /> {r.seller_name} <span className="opacity-50">·</span> {r.collection_name}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => approve(r)} className="p-2 rounded-md bg-success/10 text-success hover:bg-success/20" title="Aprovar">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => reject(r)} className="p-2 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20" title="Rejeitar">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
