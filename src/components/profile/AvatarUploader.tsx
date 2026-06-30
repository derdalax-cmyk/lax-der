import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  userId: string;
  avatarUrl: string | null;
  name: string | null;
  email: string | null;
  onChange: (url: string) => void;
};

function initials(name: string | null, email: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function AvatarUploader({ userId, avatarUrl, name, email, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) { toast.error("Formato inválido (JPG, PNG ou WEBP)"); return; }
    if (file.size > MAX_SIZE) { toast.error("Imagem maior que 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    const url = data.publicUrl;
    const { error: upErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    onChange(url);
    toast.success("Foto de perfil atualizada");
    setUploading(false);
  };

  return (
    <div className="relative">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "h-28 w-28 rounded-full ring-4 ring-background overflow-hidden bg-ink flex items-center justify-center cursor-pointer shadow-xl select-none",
        )}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-3xl font-bold text-gold">{initials(name, email)}</span>
        )}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center">
          {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
        </div>
      </div>
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-gold text-ink flex items-center justify-center shadow-md hover:scale-105 transition"
        aria-label="Mudar foto"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
    </div>
  );
}
