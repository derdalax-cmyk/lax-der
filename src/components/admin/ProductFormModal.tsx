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
import { useQueryClient } from "@tanstack/react-query";

export const CATEGORIES = ["camisas", "calcas", "sapatos", "chapeus", "calcoes", "casacos"] as const;
const GENDERS = ["masculino", "feminino", "unissex"] as const;

type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  base_price: number;
  category: string | null;
  images: unknown;
  is_unique: boolean;
  featured: boolean;
  status: "available" | "reserved" | "sold";
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: ProductRow | null; // null = create
  sellerId?: string | null; // when set, runs in seller mode (products go pending)
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

export function ProductFormModal({ open, onOpenChange, product, sellerId }: Props) {
  const isSeller = !!sellerId;
  const qc = useQueryClient();
  const productId = useMemo(() => product?.id ?? crypto.randomUUID(), [product?.id, open]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [category, setCategory] = useState<string>("");
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
  const [saving, setSaving] = useState(false);
  const [collections, setCollections] = useState<{ id: string; name: string; icon: string | null }[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    supabase.from("featured_collections").select("id,name,icon").order("sort_order").then(({ data }) => {
      setCollections(data ?? []);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (product) {
      const { text, meta } = parseMeta(product.description);
      setTitle(product.title);
      setText(text);
      setPrice(Number(product.base_price));
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
      supabase.from("product_variations").select("*").eq("product_id", product.id).then(({ data }) => {
        setVariations((data ?? []).map((v) => ({ id: v.id, size: v.size ?? "", color: v.color ?? "", stock: v.stock, price: v.price as number | null })));
      });
      supabase.from("featured_collection_products").select("collection_id").eq("product_id", product.id).then(({ data }) => {
        setSelectedCollections(new Set((data ?? []).map((r) => r.collection_id)));
      });
    } else {
      setTitle(""); setText(""); setPrice(0); setCategory(""); setGender(""); setMaterial(""); setColor(""); setBrand(""); setDefaultSize(""); setInStock(true); setIsUnique(false); setFeatured(false); setImages([]); setVariations([]); setSelectedCollections(new Set());
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
        category,
        is_unique: isUnique,
        featured: isSeller ? false : featured,
        images,
        status: inStock ? "available" as const : "sold" as const,
        ...(isSeller ? { seller_id: sellerId, approval_status: "pending" as const } : {}),
      };

      let pid = product?.id;
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert({ id: productId, ...payload }).select("id").single();
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

      toast.success(isSeller
        ? (product ? "Produto atualizado — aguarda aprovação" : "Produto enviado para aprovação")
        : (product ? "Produto atualizado" : "Produto criado"));
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["seller-products"] });
      qc.invalidateQueries({ queryKey: ["admin-featured-collections"] });
      qc.invalidateQueries({ queryKey: ["home-collections"] });
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
              <Label>Categoria *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
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

          {isSeller && (
            <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-muted-foreground">
              Os produtos que criar ou editar ficam <strong className="text-foreground">pendentes de aprovação</strong> antes de aparecerem na loja.
            </div>
          )}


          {!isSeller && <div>
            <Label className="mb-2 block">Categorias de destaque</Label>
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
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${checked ? "border-gold bg-gold/10 text-ink" : "border-border hover:bg-secondary"}`}
                    >
                      <span>{c.icon}</span> {c.name}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Se nenhuma for selecionada, o produto não aparece em destaques (continua visível no catálogo).</p>
          </div>

          <div>
            <Label className="mb-2 block">Imagens</Label>
            <ImageUploader productId={productId} value={images} onChange={setImages} />
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
