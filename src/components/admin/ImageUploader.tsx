import { useRef, useState } from "react";
import { Upload, X, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  productId: string; // use a temp UUID for new products
  pathPrefix?: string; // e.g. "sellers/<uid>" so uploads land in a folder the seller owns
  value: string[];
  onChange: (urls: string[]) => void;
};

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function ImageUploader({ productId, pathPrefix, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of arr) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: formato inválido`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: maior que 5MB`);
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
    // Extract path from public URL
    const match = url.match(/\/products\/(.+)$/);
    if (match) {
      await supabase.storage.from("products").remove([match[1]]);
    }
    onChange(value.filter((u) => u !== url));
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
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP — máx 5MB cada</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {value.map((url, idx) => (
            <div key={url} className="relative group aspect-square rounded-md overflow-hidden border border-border bg-secondary">
              <img src={url} alt="" className="w-full h-full object-cover" />
              {idx === 0 && (
                <div className="absolute top-1 left-1 bg-gold text-ink text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-current" /> Principal
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                {idx !== 0 && (
                  <button
                    type="button"
                    onClick={() => setPrimary(url)}
                    className="bg-gold text-ink rounded-full p-1.5 hover:scale-110 transition"
                    title="Definir como principal"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(url)}
                  className="bg-destructive text-destructive-foreground rounded-full p-1.5 hover:scale-110 transition"
                  title="Remover"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
