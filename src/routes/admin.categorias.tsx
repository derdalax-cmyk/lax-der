import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, GripVertical, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_ICONS, CategoryIcon } from "@/lib/categoryIcons";
import { cn } from "@/lib/utils";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/admin/categorias")({
  component: AdminCategoriasPage,
});

type Row = {
  id: string; slug: string; label: string; icon: string | null;
  sort_order: number; is_active: boolean;
};

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function SortableRow({ row, count, onEdit, onDelete }: { row: Row; count: number; onEdit: (r: Row) => void; onDelete: (r: Row) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("border-t border-border bg-card", isDragging && "opacity-60")}>
      <td className="px-2 py-3 w-8">
        <button type="button" className="cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners}>
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-secondary grid place-items-center">
            <CategoryIcon icon={row.icon} className="w-5 h-5" />
          </span>
          <span className="font-medium">{row.label}</span>
          {!row.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inativa</span>}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-muted-foreground">{row.slug}</td>
      <td className="px-3 py-3 text-sm text-muted-foreground">{count} produtos</td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-1">
          <button onClick={() => onEdit(row)} className="p-2 hover:bg-secondary rounded-md" title="Editar"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => onDelete(row)} className="p-2 hover:bg-destructive/10 text-destructive rounded-md" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );
}

function AdminCategoriasPage() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data: cats, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return (cats ?? []) as Row[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["admin-categories-counts"],
    queryFn: async () => {
      const out: Record<string, number> = {};
      await Promise.all((data ?? []).map(async (c) => {
        const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category", c.slug);
        out[c.slug] = count ?? 0;
      }));
      return out;
    },
    enabled: !!data,
  });

  useEffect(() => { if (data) setRows(data); }, [data]);

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oi = rows.findIndex((r) => r.id === active.id);
    const ni = rows.findIndex((r) => r.id === over.id);
    const next = arrayMove(rows, oi, ni);
    setRows(next);
    await Promise.all(next.map((r, i) => supabase.from("categories").update({ sort_order: i * 10 }).eq("id", r.id)));
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
    qc.invalidateQueries({ queryKey: ["public-categories"] });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if ((counts[deleteTarget.slug] ?? 0) > 0) {
      toast.error(`Não é possível remover: ${counts[deleteTarget.slug]} produtos associados.`);
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase.from("categories").delete().eq("id", deleteTarget.id);
    if (error) toast.error(error.message); else toast.success("Categoria removida");
    setDeleteTarget(null);
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
    qc.invalidateQueries({ queryKey: ["public-categories"] });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Categorias</h1>
          <p className="text-sm text-muted-foreground">Gerir categorias de produtos exibidas na loja.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="bg-gold text-ink hover:bg-gold/90">
          <Plus className="w-4 h-4 mr-1" /> Nova categoria
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-3 w-8"></th>
                <th className="px-3 py-3">Categoria</th>
                <th className="px-3 py-3">Slug</th>
                <th className="px-3 py-3">Produtos</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
              <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">A carregar…</td></tr>}
                  {!isLoading && rows.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhuma categoria. Crie a primeira.</td></tr>
                  )}
                  {rows.map((r) => <SortableRow key={r.id} row={r} count={counts[r.slug] ?? 0} onEdit={(row) => { setEditing(row); setModalOpen(true); }} onDelete={setDeleteTarget} />)}
                </tbody>
              </SortableContext>
            </DndContext>
          </table>
        </div>
      </div>

      <CategoryModal open={modalOpen} onOpenChange={setModalOpen} category={editing} nextOrder={rows.length * 10} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteTarget?.label}" da loja. Só é permitido se não houver produtos associados.
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

function CategoryModal({ open, onOpenChange, category, nextOrder }:
  { open: boolean; onOpenChange: (o: boolean) => void; category: Row | null; nextOrder: number }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [icon, setIcon] = useState<string>("tag");
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSlugEdited(!!category);
    if (category) {
      setLabel(category.label); setSlug(category.slug);
      setIcon(category.icon ?? "tag"); setIsActive(category.is_active);
    } else {
      setLabel(""); setSlug(""); setIcon("tag"); setIsActive(true);
    }
  }, [open, category]);

  useEffect(() => { if (!slugEdited) setSlug(slugify(label)); }, [label, slugEdited]);

  const uploadIcon = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("Ícone maior que 2MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `categories/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("products").upload(path, file, { upsert: false });
      if (error) throw error;
      const url = supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
      setIcon(url);
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!label.trim() || !slug.trim()) { toast.error("Preencha nome e slug"); return; }
    setSaving(true);
    try {
      const payload = { label: label.trim(), slug: slug.trim(), icon, is_active: isActive };
      if (category) {
        const { error } = await supabase.from("categories").update(payload).eq("id", category.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert({ ...payload, sort_order: nextOrder });
        if (error) throw error;
      }
      toast.success(category ? "Categoria atualizada" : "Categoria criada");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["public-categories"] });
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const isUrl = /^https?:\/\//.test(icon);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Camisas" />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={slug} onChange={(e) => { setSlugEdited(true); setSlug(slugify(e.target.value)); }} placeholder="camisas" />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Ícone</Label>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-xl bg-secondary grid place-items-center">
                <CategoryIcon icon={icon} className="w-7 h-7" />
              </div>
              <div className="flex-1 text-xs text-muted-foreground">
                {isUrl ? "Ícone personalizado (upload)" : `Ícone escolhido: ${icon}`}
                {isUrl && (
                  <button onClick={() => setIcon("tag")} className="ml-2 text-destructive inline-flex items-center gap-1">
                    <X className="w-3 h-3" /> remover
                  </button>
                )}
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-secondary cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> {uploading ? "A enviar…" : "Enviar"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadIcon(e.target.files[0])} />
              </label>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-56 overflow-y-auto p-1">
              {CATEGORY_ICONS.map((c) => {
                const Ic = c.Icon;
                return (
                  <button key={c.name} type="button" onClick={() => setIcon(c.name)}
                    title={c.label}
                    className={cn("aspect-square rounded-lg border grid place-items-center transition-colors",
                      icon === c.name ? "border-gold bg-gold/10" : "border-border hover:bg-secondary")}>
                    <Ic className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Categoria ativa</p>
              <p className="text-[11px] text-muted-foreground">Visível na loja.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
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
