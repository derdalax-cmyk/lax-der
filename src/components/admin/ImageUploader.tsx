import { useRef, useState } from "react";
import { Upload, X, Star, Eye, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { IMAGE_ACCEPT, validateUpload } from "@/lib/uploadLimits";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImageEditorDialog } from "./ImageEditorDialog";

type Props = {
  productId: string; // use a temp UUID for new products
  pathPrefix?: string; // e.g. "sellers/<uid>" so uploads land in a folder the seller owns
  value: string[];
  onChange: (urls: string[]) => void;
};

const storagePath = (url: string) => {
  const match = url.match(/\/products\/(.+?)(\?|$)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export function ImageUploader({ productId, pathPrefix, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of arr) {
      const invalid = validateUpload(file, "image");
      if (invalid) {
        toast.error(invalid);
        continue;
      }
      const ext = file.name.split(".").pop();
      const path = `${pathPrefix ? `${pathPrefix}/` : ""}${productId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("products").upload(path, file, { upsert: false });
      if (error) {
        toast.error(`Erro: ${error.message}`);
        continue;
      }
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }
    setUploading(false);
    if (uploaded.length) {
      onChange([...value, ...uploaded]);
      toast.success(`${uploaded.length} imagem(ns) enviada(s)`);
    }
  };

  const remove = async (url: string) => {
    const path = storagePath(url);
    if (path) await supabase.storage.from("products").remove([path]);
    onChange(value.filter((u) => u !== url));
    toast.success("Imagem removida");
  };

  /** Guarda a versão editada como novo ficheiro e substitui a original na mesma posição. */
  const replaceEdited = async (url: string, blob: Blob) => {
    const path = `${pathPrefix ? `${pathPrefix}/` : ""}${productId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from("products")
      .upload(path, blob, { upsert: false, contentType: "image/jpeg" });
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    onChange(value.map((u) => (u === url ? data.publicUrl : u)));
    const old = storagePath(url);
    if (old) await supabase.storage.from("products").remove([old]);
    toast.success("Imagem atualizada");
  };

  const setPrimary = (url: string) => {
    onChange([url, ...value.filter((u) => u !== url)]);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragging ? "border-gold bg-gold/5" : "border-border hover:border-gold/60",
        )}
      >
        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">{uploading ? "A enviar…" : "Arraste imagens ou clique para escolher"}</p>
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP — máx 10MB cada</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {value.map((url, idx) => (
            <div key={url} className="rounded-md border border-border overflow-hidden bg-secondary">
              <div className="relative aspect-square">
                <img src={url} alt="" className="w-full h-full object-cover" />
                {idx === 0 && (
                  <div className="absolute top-1 left-1 bg-gold text-ink text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-current" /> Principal
                  </div>
                )}
                {idx !== 0 && (
                  <button
                    type="button"
                    onClick={() => setPrimary(url)}
                    className="absolute top-1 right-1 bg-gold text-ink rounded-full p-1.5 hover:scale-110 transition"
                    title="Definir como principal"
                    aria-label="Definir como imagem principal"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-stretch divide-x divide-border border-t border-border text-[11px]">
                <button
                  type="button"
                  onClick={() => setPreview(url)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 hover:bg-secondary/70 transition"
                  aria-label="Visualizar imagem"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(url)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 hover:bg-secondary/70 transition"
                  aria-label="Editar imagem"
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(url)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-destructive hover:bg-destructive/10 transition"
                  aria-label="Remover imagem"
                >
                  <X className="w-3.5 h-3.5" /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Imagem do produto</DialogTitle>
          </DialogHeader>
          {preview && <img src={preview} alt="" className="w-full max-h-[65vh] object-contain rounded-md" />}
        </DialogContent>
      </Dialog>

      {editing && (
        <ImageEditorDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          url={editing}
          onSave={(blob) => replaceEdited(editing, blob)}
        />
      )}

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              A imagem deixa de aparecer no produto e não será usada na análise com IA.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const url = confirmRemove!;
                setConfirmRemove(null);
                void remove(url);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
