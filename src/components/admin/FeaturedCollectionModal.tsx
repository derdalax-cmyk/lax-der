import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CATEGORY_ICONS, CategoryIcon } from "@/lib/categoryIcons";
import { cn } from "@/lib/utils";
import { GripVertical, X, Search, Plus, ImagePlus, Upload } from "lucide-react";

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type FeaturedCollection = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
  cover_image?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  max_products_per_seller?: number;
  hidden_sellers?: string[];
  is_active?: boolean;
  auto_approve?: boolean;
};

type ProductLite = { id: string; title: string; images: unknown; base_price: number };

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function firstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0) {
    const f = images[0];
    if (typeof f === "string") return f;
    if (f && typeof f === "object" && "url" in f) return String((f as { url: unknown }).url);
  }
  return null;
}

// Convert an ISO timestamp to a value usable by <input type="datetime-local">
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function SortableProductRow({ p, onRemove }: { p: ProductLite; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const img = firstImage(p.images);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-3 bg-background border border-border rounded-lg px-2 py-2", isDragging && "opacity-60 shadow-md")}
    >
      <button type="button" className="cursor-grab touch-none text-muted-foreground p-1" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-9 h-9 rounded bg-secondary overflow-hidden shrink-0">
        {img && <img src={img} alt={p.title} className="w-full h-full object-cover" />}
      </div>
      <span className="text-sm flex-1 min-w-0 truncate">{p.title}</span>
      <button type="button" onClick={() => onRemove(p.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  collection: FeaturedCollection | null;
  nextSortOrder: number;
};

export function FeaturedCollectionModal({ open, onOpenChange, collection, nextSortOrder }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [icon, setIcon] = useState<string>("tag");
  const [selected, setSelected] = useState<ProductLite[]>([]);
  const [saving, setSaving] = useState(false);

  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxPerSeller, setMaxPerSeller] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const [hiddenSellers, setHiddenSellers] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductLite[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: sellers = [] } = useQuery({
    queryKey: ["approved-sellers-lite"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("sellers")
        .select("id,store_name")
        .eq("status", "approved")
        .order("store_name");
      return (data ?? []) as { id: string; store_name: string }[];
    },
  });

  useEffect(() => {
    if (!open) return;
    setSlugEdited(!!collection);
    setSearch("");
    setResults([]);
    if (collection) {
      setName(collection.name);
      setSlug(collection.slug);
      setIcon(collection.icon ?? "tag");
      setCoverImage(collection.cover_image ?? null);
      setStartsAt(toLocalInput(collection.starts_at));
      setEndsAt(toLocalInput(collection.ends_at));
      setMaxPerSeller(collection.max_products_per_seller ?? 0);
      setIsActive(collection.is_active ?? true);
      setAutoApprove(collection.auto_approve ?? false);
      setHiddenSellers(new Set(collection.hidden_sellers ?? []));
      (async () => {
        const { data: links } = await supabase
          .from("featured_collection_products")
          .select("product_id,sort_order")
          .eq("collection_id", collection.id)
          .order("sort_order", { ascending: true });
        const ids = (links ?? []).map((l) => l.product_id);
        if (!ids.length) { setSelected([]); return; }
        const { data: prods } = await supabase.from("products").select("id,title,images,base_price").in("id", ids);
        const byId = new Map((prods ?? []).map((p) => [p.id, p as ProductLite]));
        setSelected(ids.map((id) => byId.get(id)).filter((p): p is ProductLite => !!p));
      })();
    } else {
      setName(""); setSlug(""); setIcon("tag"); setSelected([]);
      setCoverImage(null); setStartsAt(""); setEndsAt(""); setMaxPerSeller(0); setIsActive(true);
      setAutoApprove(false);
      setHiddenSellers(new Set());
    }
  }, [open, collection]);

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (!search.trim()) { setResults([]); return; }
      const { data } = await supabase
        .from("products")
        .select("id,title,images,base_price")
        .ilike("title", `%${search.trim()}%`)
        .limit(8);
      setResults((data ?? []) as ProductLite[]);
    }, 250);
    return () => clearTimeout(t);
  }, [search, open]);

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

  const addProduct = (p: ProductLite) => {
    if (selectedIds.has(p.id)) return;
    setSelected((prev) => [...prev, p]);
    setSearch("");
    setResults([]);
  };

  const removeProduct = (id: string) => setSelected((prev) => prev.filter((p) => p.id !== id));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSelected((prev) => {
      const oldI = prev.findIndex((p) => p.id === active.id);
      const newI = prev.findIndex((p) => p.id === over.id);
      return arrayMove(prev, oldI, newI);
    });
  };

  const uploadCover = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Formato inválido"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem maior que 5MB"); return; }
    setUploadingCover(true);
    const ext = file.name.split(".").pop();
    const path = `collections/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: false });
    setUploadingCover(false);
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    setCoverImage(data.publicUrl);
  };

  const toggleHidden = (id: string) => {
    setHiddenSellers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!name.trim() || !slug.trim()) { toast.error("Preencha nome e slug"); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        icon,
        cover_image: coverImage,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        max_products_per_seller: Number.isFinite(maxPerSeller) ? Math.max(0, maxPerSeller) : 0,
        hidden_sellers: [...hiddenSellers],
        is_active: isActive,
        auto_approve: autoApprove,
      };
      let collectionId = collection?.id;
      if (collection) {
        const { error } = await supabase.from("featured_collections").update(payload).eq("id", collection.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("featured_collections")
          .insert({ ...payload, sort_order: nextSortOrder })
          .select("id").single();
        if (error) throw error;
        collectionId = data.id;
      }

      if (collectionId) {
        // Admin manages the curated (admin-added) products; keep seller submissions intact.
        await supabase.from("featured_collection_products")
          .delete().eq("collection_id", collectionId).is("submitted_by", null);
        if (selected.length) {
          const rows = selected.map((p, i) => ({
            collection_id: collectionId!, product_id: p.id, sort_order: i, status: "approved", submitted_by: null,
          }));
          const { error } = await supabase.from("featured_collection_products").upsert(rows, { onConflict: "collection_id,product_id" });
          if (error) throw error;
        }
      }

      toast.success(collection ? "Categoria atualizada" : "Categoria criada");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {collection ? "Editar categoria de destaque" : "Nova categoria de destaque"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Destaques da Semana" />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={slug} onChange={(e) => { setSlugEdited(true); setSlug(slugify(e.target.value)); }} placeholder="destaques-da-semana" />
            </div>
          </div>

          {/* Cover image */}
          <div>
            <Label className="mb-2 block">Imagem de capa (opcional)</Label>
            {coverImage ? (
              <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border">
                <img src={coverImage} alt="Capa" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImage(null)}
                  className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-gold/60 transition-colors">
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{uploadingCover ? "A enviar…" : "Escolher imagem"}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
              </label>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Ícone</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIcon("")}
                className={cn("h-10 px-3 rounded-lg border text-xs font-medium flex items-center justify-center transition-colors",
                  icon === "" ? "border-gold bg-gold/10" : "border-border hover:bg-secondary")}
              >
                Sem ícone
              </button>
              {FEATURED_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={cn("w-10 h-10 rounded-lg border text-xl flex items-center justify-center transition-colors",
                    icon === ic ? "border-gold bg-gold/10" : "border-border hover:bg-secondary")}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Scheduling + limit + active */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Início (opcional)</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label>Fim (opcional)</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 items-end">
            <div>
              <Label>Máx. produtos por vendedor</Label>
              <Input
                type="number" min={0} value={maxPerSeller}
                onChange={(e) => setMaxPerSeller(parseInt(e.target.value || "0", 10))}
                placeholder="0 = ilimitado"
              />
              <p className="text-[11px] text-muted-foreground mt-1">0 = sem limite.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Destaque ativo</p>
                <p className="text-[11px] text-muted-foreground">Visível na loja e para vendedores.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Aprovação automática</p>
              <p className="text-[11px] text-muted-foreground">Produtos submetidos por vendedores entram já aprovados neste destaque.</p>
            </div>
            <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
          </div>

          {/* Hidden sellers */}
          <div>
            <Label className="mb-2 block">Ocultar para vendedores</Label>
            {sellers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum vendedor aprovado.</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {sellers.map((s) => {
                  const hidden = hiddenSellers.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleHidden(s.id)}
                      className={cn("px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                        hidden ? "border-destructive bg-destructive/10 text-destructive" : "border-border hover:bg-secondary")}
                    >
                      {hidden ? "🚫 " : ""}{s.store_name}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">Vendedores selecionados não podem candidatar produtos a este destaque.</p>
          </div>

          <div>
            <Label className="mb-2 block">Adicionar produtos (curadoria do admin)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar produto…" className="pl-9" />
            </div>
            {results.length > 0 && (
              <div className="mt-2 border border-border rounded-lg divide-y divide-border overflow-hidden">
                {results.map((p) => {
                  const img = firstImage(p.images);
                  const added = selectedIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={added}
                      onClick={() => addProduct(p)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded bg-secondary overflow-hidden shrink-0">
                        {img && <img src={img} alt={p.title} className="w-full h-full object-cover" />}
                      </div>
                      <span className="text-sm flex-1 min-w-0 truncate">{p.title}</span>
                      {added ? <span className="text-xs text-muted-foreground">Adicionado</span> : <Plus className="w-4 h-4 text-gold" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Produtos na categoria ({selected.length}) — arraste para ordenar</Label>
            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">Nenhum produto adicionado.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
                <SortableContext items={selected.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {selected.map((p) => <SortableProductRow key={p.id} p={p} onRemove={removeProduct} />)}
                  </div>
                </SortableContext>
              </DndContext>
            )}
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
