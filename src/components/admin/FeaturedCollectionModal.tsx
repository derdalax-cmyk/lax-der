import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { FEATURED_ICONS } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { GripVertical, X, Search, Plus } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type FeaturedCollection = { id: string; name: string; slug: string; icon: string | null; sort_order: number };

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
  const [icon, setIcon] = useState<string>(FEATURED_ICONS[0]);
  const [selected, setSelected] = useState<ProductLite[]>([]);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductLite[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!open) return;
    setSlugEdited(!!collection);
    setSearch("");
    setResults([]);
    if (collection) {
      setName(collection.name);
      setSlug(collection.slug);
      setIcon(collection.icon ?? FEATURED_ICONS[0]);
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
      setName(""); setSlug(""); setIcon(FEATURED_ICONS[0]); setSelected([]);
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

  const save = async () => {
    if (!name.trim() || !slug.trim()) { toast.error("Preencha nome e slug"); return; }
    setSaving(true);
    try {
      let collectionId = collection?.id;
      if (collection) {
        const { error } = await supabase.from("featured_collections")
          .update({ name: name.trim(), slug: slug.trim(), icon }).eq("id", collection.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("featured_collections")
          .insert({ name: name.trim(), slug: slug.trim(), icon, sort_order: nextSortOrder })
          .select("id").single();
        if (error) throw error;
        collectionId = data.id;
      }

      if (collectionId) {
        await supabase.from("featured_collection_products").delete().eq("collection_id", collectionId);
        if (selected.length) {
          const rows = selected.map((p, i) => ({ collection_id: collectionId!, product_id: p.id, sort_order: i }));
          const { error } = await supabase.from("featured_collection_products").insert(rows);
          if (error) throw error;
        }
      }

      toast.success(collection ? "Categoria atualizada" : "Categoria criada");
      qc.invalidateQueries({ queryKey: ["admin-featured-collections"] });
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
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recomendação de Camisas" />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={slug} onChange={(e) => { setSlugEdited(true); setSlug(slugify(e.target.value)); }} placeholder="recomendacao-camisas" />
            </div>
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

          <div>
            <Label className="mb-2 block">Adicionar produtos</Label>
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
