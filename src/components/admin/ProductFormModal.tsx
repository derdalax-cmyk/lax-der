import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploader } from "./ImageUploader";
import { VariationsTable, type Variation } from "./VariationsTable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";

const GENDERS = ["masculino", "feminino", "unissex"] as const;

type ProductStatus = "available" | "reserved" | "sold" | "out_of_stock" | "inactive";

type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  base_price: number;
  shipping_fee: number | null;
  category: string | null;
  images: unknown;
  is_unique: boolean;
  featured: boolean;
  status: ProductStatus;
  stock?: number | null;
  stock_alert?: number | null;
  approval_status?: string | null;
};

type SellerCollection = {
  id: string;
  name: string;
  icon: string | null;
  max_products_per_seller: number;
  submissions: { product_id: string; status: string }[];
};




type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: ProductRow | null; // null = create
  sellerId?: string | null; // when set, runs in seller mode (products go pending)
  collaborator?: boolean; // collaborator of the store: no featured collections, owner fixed
};

type Meta = { gender?: string; material?: string; color?: string; brand?: string; default_size?: string; in_stock?: boolean };

function parseMeta(desc: string | null): { text: string; meta: Meta } {
  if (!desc) return { text: "", meta: {} };
  const m = desc.match(/<!--META:(.+?)-->/s);
  if (!m) return { text: desc, meta: {} };
  try {
    return { text: desc.replace(m[0], "").trim(), meta: JSON.parse(m[1]) };
  } catch {
    return { text: desc, meta: {} };
  }
}

function packMeta(text: string, meta: Meta): string {
  return `${text}\n<!--META:${JSON.stringify(meta)}-->`;
}

export function ProductFormModal({ open, onOpenChange, product, sellerId, collaborator }: Props) {
  const isSeller = !!sellerId;
  const isCollab = !!collaborator;
  const { user } = useAuth();
  const qc = useQueryClient();
  const productId = useMemo(() => product?.id ?? crypto.randomUUID(), [product?.id, open]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [category, setCategory] = useState<string>("");
  const { categories } = useCategories();
  const [gender, setGender] = useState<string>("");
  const [material, setMaterial] = useState("");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [defaultSize, setDefaultSize] = useState("");
  const [inStock, setInStock] = useState(true);
  const [isUnique, setIsUnique] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [status, setStatus] = useState<ProductStatus>("available");
  const [stock, setStock] = useState<number>(0);
  const [stockAlert, setStockAlert] = useState<number>(5);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [aiAllowed, setAiAllowed] = useState(false);
  const [collections, setCollections] = useState<{ id: string; name: string; icon: string | null }[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !sellerId) { setAiAllowed(false); return; }
    setAiUsed(false);
    supabase.rpc("can_use_ai_generator", { _seller_id: sellerId }).then(({ data }) => {
      setAiAllowed(data === true);
    });
  }, [open, sellerId]);

  const runAi = async () => {
    if (!sellerId || images.length === 0) return;
    setAiLoading(true);
    try {
      const { generateProductFields } = await import("@/lib/ai-product.functions");
      const res = await generateProductFields({
        data: { sellerId, images, productId: product?.id ?? null },
      });
      if (!res.ok) { toast.error(res.error); return; }
      setTitle(res.data.nome);
      setText(res.data.descricao);
      setMaterial(res.data.material);
      setAiUsed(true);
      toast.success("Dados gerados. Reveja antes de guardar.");
    } catch {
      toast.error("Não foi possível gerar os dados neste momento. Tente novamente.");
    } finally {
      setAiLoading(false);
    }
  };


  useEffect(() => {
    if (!open || isCollab) return;
    let query = supabase.from("featured_collections").select("id,name,icon").order("sort_order");
    if (isSeller && sellerId) {
      query = query.eq("is_active", true).not("hidden_sellers", "cs", `{${sellerId}}`);
    }
    query.then(({ data }) => {
      setCollections(data ?? []);
    });
  }, [open, isSeller, sellerId]);

  useEffect(() => {
    if (!open) return;
    if (product) {
      const { text, meta } = parseMeta(product.description);
      setTitle(product.title);
      setText(text);
      setPrice(Number(product.base_price));
      setShippingFee(Number(product.shipping_fee ?? 0));
      setCategory(product.category ?? "");
      setGender(meta.gender ?? "");
      setMaterial(meta.material ?? "");
      setColor(meta.color ?? "");
      setBrand(meta.brand ?? "");
      setDefaultSize(meta.default_size ?? "");
      setInStock(meta.in_stock ?? true);
      setIsUnique(product.is_unique);
      setFeatured(product.featured);
      setImages(Array.isArray(product.images) ? (product.images as string[]) : []);
      setStatus((product.status as ProductStatus) ?? "available");
      setStock(Number(product.stock ?? 0));
      setStockAlert(Number(product.stock_alert ?? 5));
      supabase.from("product_variations").select("*").eq("product_id", product.id).then(({ data }) => {
        setVariations((data ?? []).map((v) => ({ id: v.id, size: v.size ?? "", color: v.color ?? "", stock: v.stock, price: v.price as number | null })));
      });
      let membershipQuery = supabase.from("featured_collection_products").select("collection_id").eq("product_id", product.id);
      if (isSeller && sellerId) membershipQuery = membershipQuery.eq("seller_id", sellerId);
      membershipQuery.then(({ data }) => {
        setSelectedCollections(new Set((data ?? []).map((r) => r.collection_id)));
      });
    } else {
      setTitle(""); setText(""); setPrice(0); setShippingFee(0); setCategory(""); setGender(""); setMaterial(""); setColor(""); setBrand(""); setDefaultSize(""); setInStock(true); setIsUnique(false); setFeatured(false); setImages([]); setVariations([]); setSelectedCollections(new Set()); setStatus("available"); setStock(0); setStockAlert(5);
    }
  }, [product, open]);

  const save = async () => {
    if (!title.trim() || !category || price < 0) {
      toast.error("Preencha título, categoria e preço");
      return;
    }
    setSaving(true);
    try {
      const meta: Meta = { gender: gender || undefined, material: material || undefined, color: color || undefined, brand: brand || undefined, default_size: defaultSize || undefined, in_stock: inStock };
      const payload = {
        title: title.trim(),
        description: packMeta(text.trim(), meta),
        base_price: price,
        shipping_fee: shippingFee || 0,
        category,
        is_unique: isUnique,
        featured: isSeller ? false : featured,
        images,
        ...(isSeller ? { seller_id: sellerId } : {}),
      };

      let pid = product?.id;
      const hasVariations = variations.length > 0;
      // Determine effective status from the explicit select, honoring the "Em estoque" toggle for non-unique products.
      let effectiveStatus: ProductStatus = status;
      if (!isUnique) {
        if (status === "available" && !inStock) effectiveStatus = "out_of_stock";
        if (status === "out_of_stock" && inStock) effectiveStatus = "available";
      }
      const stockPayload = !isUnique && !hasVariations
        ? { stock: Math.max(0, stock), stock_alert: Math.max(0, stockAlert) }
        : {};
      if (product) {
        const updatePayload = !isUnique
          ? { ...payload, ...stockPayload, status: effectiveStatus }
          : { ...payload, status: effectiveStatus === "inactive" || effectiveStatus === "available" ? effectiveStatus : product.status };
        const { error } = await supabase.from("products").update(updatePayload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert({ id: productId, ...payload, ...stockPayload, status: isUnique ? "available" as const : effectiveStatus }).select("id").single();
        if (error) throw error;
        pid = data.id;
      }


      if (pid) {
        await supabase.from("product_variations").delete().eq("product_id", pid);
        if (variations.length) {
          const rows = variations.map((v) => ({
            product_id: pid!,
            size: v.size || null,
            color: v.color || null,
            stock: isUnique ? Math.min(v.stock, 1) : v.stock,
            price: v.price,
          }));
          const { error } = await supabase.from("product_variations").insert(rows);
          if (error) throw error;
        }
      }

      if (pid && !isSeller) {
        // Sync featured collection memberships for this product (admin only)
        await supabase.from("featured_collection_products").delete().eq("product_id", pid);
        const chosen = [...selectedCollections];
        if (chosen.length) {
          const { data: maxRows } = await supabase
            .from("featured_collection_products")
            .select("collection_id,sort_order")
            .in("collection_id", chosen);
          const maxByCol: Record<string, number> = {};
          (maxRows ?? []).forEach((r) => {
            maxByCol[r.collection_id] = Math.max(maxByCol[r.collection_id] ?? -1, r.sort_order);
          });
          const rows = chosen.map((cid) => ({ collection_id: cid, product_id: pid!, sort_order: (maxByCol[cid] ?? -1) + 1 }));
          const { error } = await supabase.from("featured_collection_products").insert(rows);
          if (error) throw error;
        }
      }

      if (pid && isSeller && !isCollab) {
        const { data: currentRows, error: currentError } = await supabase
          .from("featured_collection_products")
          .select("collection_id,status")
          .eq("product_id", pid)
          .eq("seller_id", sellerId!);
        if (currentError) throw currentError;

        const current = new Map((currentRows ?? []).map((r) => [r.collection_id, r.status]));
        const chosen = [...selectedCollections];
        const toAdd = chosen.filter((cid) => !current.has(cid));
        const toRemove = [...current.entries()]
          .filter(([cid, submissionStatus]) => !selectedCollections.has(cid) && submissionStatus !== "approved")
          .map(([cid]) => cid);

        for (const collectionId of toAdd) {
          const { error } = await supabase.rpc("submit_products_to_collection", {
            _collection_id: collectionId,
            _product_ids: [pid],
          });
          if (error) throw error;
        }
        for (const collectionId of toRemove) {
          const { error } = await supabase.rpc("withdraw_product_from_collection", {
            _collection_id: collectionId,
            _product_id: pid,
          });
          if (error) throw error;
        }
      }

      toast.success(isSeller
        ? (product ? "Produto e destaques atualizados" : "Produto criado e destaques enviados para aprovação")
        : (product ? "Produto atualizado" : "Produto criado"));
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["seller-products"] });
      qc.invalidateQueries({ queryKey: ["admin-featured-collections"] });
      qc.invalidateQueries({ queryKey: ["home-collections"] });
      qc.invalidateQueries({ queryKey: ["collab-products"] });
      qc.invalidateQueries({ queryKey: ["my-collaborations"] });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{product ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Preço base (MT) *</Label>
              <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
            <div>
              <Label>Frete de entrega (MT)</Label>
              <Input type="number" min={0} step="0.01" value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value))} placeholder="0 = Grátis" />
              <p className="text-[11px] text-muted-foreground mt-1">Deixe 0 (ou vazio) para <strong>Frete Grátis</strong>.</p>
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}
                  {category && !categories.some((c) => c.slug === category) && (
                    <SelectItem value={category} className="capitalize">{category} (removida)</SelectItem>
                  )}
                  {categories.length === 0 && !category && (
                    <div className="px-2 py-3 text-xs text-muted-foreground">Nenhuma categoria ativa. Crie uma em Admin → Categorias.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gênero</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Marca</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div>
              <Label>Material</Label>
              <Input value={material} onChange={(e) => setMaterial(e.target.value)} />
            </div>
            <div>
              <Label>Cor</Label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <div>
              <Label>Tamanho padrão</Label>
              <Input value={defaultSize} onChange={(e) => setDefaultSize(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 py-2">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={isUnique} onCheckedChange={(v) => setIsUnique(!!v)} /> Peça única</label>
            {!isSeller && <label className="flex items-center gap-2 text-sm"><Checkbox checked={featured} onCheckedChange={(v) => setFeatured(!!v)} /> Destaque</label>}
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={inStock} onCheckedChange={(v) => setInStock(!!v)} /> Em estoque</label>
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Estado do produto</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Disponível</SelectItem>
                  <SelectItem value="out_of_stock">Sem stock</SelectItem>
                  <SelectItem value="inactive">Inativo (oculto)</SelectItem>
                  {!isUnique && <SelectItem value="sold">Esgotado</SelectItem>}
                  {isUnique && status === "reserved" && <SelectItem value="reserved" disabled>Reservado</SelectItem>}
                  {isUnique && status === "sold" && <SelectItem value="sold" disabled>Vendido</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {!isUnique && variations.length === 0 && (
              <>
                <div>
                  <Label>Stock disponível</Label>
                  <Input type="number" min={0} value={stock} onChange={(e) => setStock(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Alerta de stock</Label>
                  <Input type="number" min={0} value={stockAlert} onChange={(e) => setStockAlert(Number(e.target.value))} />
                </div>
              </>
            )}
          </div>

          {isSeller && (
            <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-muted-foreground">
              Os produtos que criar ou editar ficam <strong className="text-foreground">pendentes de aprovação</strong> antes de aparecerem na loja.
            </div>
          )}



          {!isCollab && (
          <div>
            <Label className="mb-2 block">{isSeller ? "Adicionar a Destaques" : "Categorias de destaque"}</Label>
            {collections.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma categoria de destaque criada ainda.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {collections.map((c) => {
                  const checked = selectedCollections.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCollections((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                        return next;
                      })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors ${checked ? "border-gold bg-gold/10 text-ink" : "border-border hover:bg-secondary"}`}
                    >
                      <span>{c.icon}</span> {c.name}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {isSeller
                ? "A candidatura fica pendente até à aprovação da administração. Os limites de cada destaque são aplicados automaticamente."
                : "Se nenhuma for selecionada, o produto não aparece em destaques (continua visível no catálogo)."}
            </p>
          </div>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <Label className="block">Imagens</Label>
              {aiAllowed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-gold/50 text-ink hover:bg-gold/10"
                  disabled={aiLoading || images.length === 0}
                  onClick={runAi}
                >
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-gold" />}
                  {aiLoading ? "A analisar fotos…" : aiUsed ? "Gerar novamente" : "Gerar dados com IA"}
                </Button>
              )}
            </div>
            {aiAllowed && (
              <p className="text-[11px] text-muted-foreground mb-2">
                Todas as fotos são analisadas em conjunto como <strong>a mesma peça</strong> e a IA preenche apenas <strong>título, descrição e material</strong>. Reveja antes de guardar.
              </p>
            )}
            <ImageUploader productId={productId} pathPrefix={isSeller && user ? `sellers/${user.id}` : undefined} value={images} onChange={setImages} />
          </div>


          <div>
            <Label className="mb-2 block">Variações</Label>
            <VariationsTable value={variations} onChange={setVariations} />
            {isUnique && <p className="text-xs text-muted-foreground mt-1">Peça única: estoque limitado a 1 por variação.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-gold text-ink hover:bg-gold/90">
            {saving ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { ProductRow };
