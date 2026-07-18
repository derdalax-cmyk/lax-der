import { createFileRoute } from "@tanstack/react-router";
import { CategoryIcon } from "@/lib/categoryIcons";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { FeaturedCollectionModal, type FeaturedCollection } from "@/components/admin/FeaturedCollectionModal";
import { PendingCandidacies } from "@/components/admin/PendingCandidacies";
import { cn } from "@/lib/utils";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/admin/categorias-destaque")({
  component: AdminFeaturedCollections,
});

type Row = FeaturedCollection & { count: number };

function SortableRow({ row, onEdit, onDelete }: { row: Row; onEdit: (r: Row) => void; onDelete: (r: Row) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("border-t border-border bg-card", isDragging && "opacity-60")}
    >
      <td className="px-2 py-3 w-8">
        <button type="button" className="cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners}>
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center gap-2">
          {row.cover_image ? (
            <img src={row.cover_image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
          ) : row.icon ? (
            <CategoryIcon icon={row.icon} className="w-6 h-6" />
          ) : null}

          <span className="font-medium">{row.name}</span>
          {row.is_active === false && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inativo</span>
          )}
        </span>
      </td>
      <td className="px-3 py-3 text-muted-foreground text-sm">{row.slug}</td>
      <td className="px-3 py-3 text-muted-foreground text-sm">{row.count} produtos</td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-1">
          <button onClick={() => onEdit(row)} className="p-2 hover:bg-secondary rounded-md" title="Editar"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => onDelete(row)} className="p-2 hover:bg-destructive/10 text-destructive rounded-md" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );
}

function AdminFeaturedCollections() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeaturedCollection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data, isLoading } = useQuery({
    queryKey: ["admin-featured-collections"],
    queryFn: async () => {
      const { data: cols, error } = await supabase
        .from("featured_collections")
        .select("id,name,slug,icon,sort_order,cover_image,starts_at,ends_at,max_products_per_seller,hidden_sellers,is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const { data: links } = await supabase.from("featured_collection_products").select("collection_id").eq("status", "approved");
      const counts: Record<string, number> = {};
      (links ?? []).forEach((l) => { counts[l.collection_id] = (counts[l.collection_id] ?? 0) + 1; });
      return (cols ?? []).map((c) => ({ ...c, count: counts[c.id] ?? 0 })) as Row[];
    },
  });

  useEffect(() => { if (data) setRows(data); }, [data]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r: Row) => { setEditing(r); setModalOpen(true); };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = rows.findIndex((r) => r.id === active.id);
    const newI = rows.findIndex((r) => r.id === over.id);
    const next = arrayMove(rows, oldI, newI);
    setRows(next);
    await Promise.all(next.map((r, i) => supabase.from("featured_collections").update({ sort_order: i }).eq("id", r.id)));
    qc.invalidateQueries({ queryKey: ["admin-featured-collections"] });
    qc.invalidateQueries({ queryKey: ["home-collections"] });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("featured_collections").delete().eq("id", deleteTarget.id);
    if (error) toast.error(error.message);
    else toast.success("Categoria removida");
    setDeleteTarget(null);
    qc.invalidateQueries({ queryKey: ["admin-featured-collections"] });
    qc.invalidateQueries({ queryKey: ["home-collections"] });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Categorias de destaque</h1>
          <p className="text-sm text-muted-foreground">Secções de produtos exibidas na página inicial.</p>
        </div>
        <Button onClick={openCreate} className="bg-gold text-ink hover:bg-gold/90">
          <Plus className="w-4 h-4 mr-1" /> Nova categoria de destaque
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
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhuma categoria de destaque. Crie a primeira.</td></tr>
                  )}
                  {rows.map((r) => <SortableRow key={r.id} row={r} onEdit={openEdit} onDelete={setDeleteTarget} />)}
                </tbody>
              </SortableContext>
            </DndContext>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <PendingCandidacies />
      </div>

      <FeaturedCollectionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        collection={editing}
        nextSortOrder={rows.length}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categoria de destaque?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove a categoria "{deleteTarget?.name}" da página inicial. Os produtos não são apagados.
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
