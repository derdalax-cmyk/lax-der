import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/banners")({
  head: () => ({ meta: [{ title: "Banners da Home · Admin DERDALAX" }, { name: "description", content: "Gestão das imagens e textos dos banners da página inicial DERDALAX." }, { property: "og:title", content: "Banners da Home · Admin DERDALAX" }, { property: "og:description", content: "Gestão das imagens e textos dos banners da página inicial DERDALAX." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AdminBanners,
});

type Banner = { id: string; title: string; image_url: string; subtitle: string | null; alt: string | null; link_url: string | null; cta_label: string | null; is_active: boolean; sort_order: number };
const MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TITLE = "Conectamos-te ao que procuras.";

function AdminBanners() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newTitle, setNewTitle] = useState(DEFAULT_TITLE);
  const { data: banners = [], refetch, isPending } = useQuery({
    queryKey: ["admin-home-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("home_banners").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return (data ?? []) as Banner[];
    },
  });
  const done = () => { refetch(); qc.invalidateQueries({ queryKey: ["home-banners"] }); };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let order = banners.reduce((m, b) => Math.max(m, b.sort_order), -1);
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) { toast.error(`${f.name}: não é uma imagem`); continue; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name}: máximo 5 MB`); continue; }
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `banners/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("products").upload(path, f, { contentType: f.type, upsert: false });
      if (upErr) { toast.error(upErr.message); continue; }
      const url = supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
      order += 1;
      const { error } = await supabase.from("home_banners").insert({ title: newTitle.trim().slice(0, 120), image_url: url, sort_order: order });
      if (error) toast.error(error.message);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    done();
    toast.success("Banner(s) adicionado(s)");
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= banners.length) return;
    const list = [...banners];
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((b, k) => supabase.from("home_banners").update({ sort_order: k }).eq("id", b.id)));
    done();
  };

  const remove = async (b: Banner) => {
    if (!confirm("Remover este banner?")) return;
    const { error } = await supabase.from("home_banners").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    const marker = "/object/public/products/";
    const k = b.image_url.indexOf(marker);
    if (k >= 0) await supabase.storage.from("products").remove([b.image_url.slice(k + marker.length)]);
    toast.success("Banner removido");
    done();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Banners da Home</h1>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        <div className="flex w-full sm:w-auto flex-wrap items-end gap-2">
        <div className="flex-1 min-w-0 sm:w-80"><Label htmlFor="new-banner-title" className="text-xs">Título principal do novo banner</Label><Input id="new-banner-title" value={newTitle} maxLength={120} disabled={uploading} onChange={(e) => setNewTitle(e.target.value)} /></div>
        <Button onClick={() => fileRef.current?.click()} disabled={uploading || !newTitle.trim()} className="bg-gold text-ink hover:bg-gold/90">
          {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1" />} Adicionar banners
        </Button>
        </div>
      </div>
      {isPending ? <div className="h-40 rounded-xl bg-secondary animate-pulse" /> : banners.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-5">Ainda não existem banners. A Home está a usar a imagem padrão.</p>
      ) : (
        <div className="space-y-3">
          {banners.map((b, i) => <BannerRow key={b.id} b={b} first={i === 0} last={i === banners.length - 1} onMove={(d) => move(i, d)} onRemove={() => remove(b)} onSaved={done} />)}
        </div>
      )}
    </div>
  );
}

function BannerRow({ b, first, last, onMove, onRemove, onSaved }: { b: Banner; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; onRemove: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: b.title ?? DEFAULT_TITLE, subtitle: b.subtitle ?? "", alt: b.alt ?? "", link_url: b.link_url ?? "", cta_label: b.cta_label ?? "" });
  const [busy, setBusy] = useState(false);
  const save = async (patch?: Partial<Banner>) => {
    if (!patch && !f.title.trim()) { toast.error("Introduza o título principal do banner."); return; }
    const link = f.link_url.trim();
    if (link && !/^(https?:\/\/|\/)/i.test(link)) { toast.error("O link deve começar por / ou https://"); return; }
    setBusy(true);
    const { error } = await supabase.from("home_banners").update(patch ?? {
      title: f.title.trim().slice(0, 120),
      subtitle: f.subtitle.trim().slice(0, 160) || null, alt: f.alt.trim() || null,
      link_url: link || null, cta_label: f.cta_label.trim().slice(0, 40) || null,
    }).eq("id", b.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!patch) toast.success("Banner guardado");
    onSaved();
  };
  return (
    <div className="bg-card border border-border rounded-xl p-3 grid gap-3 md:grid-cols-[220px_1fr_auto] items-start">
      <img src={b.image_url} alt={b.alt || "Banner"} className={`w-full aspect-[16/7] object-cover rounded-lg ${b.is_active ? "" : "opacity-50"}`} />
      <div className="grid sm:grid-cols-2 gap-2">
        <div className="sm:col-span-2"><Label htmlFor={`banner-title-${b.id}`} className="text-xs">Título principal</Label><Input id={`banner-title-${b.id}`} value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={DEFAULT_TITLE} /></div>
        <div className="sm:col-span-2"><Label className="text-xs">Texto secundário</Label><Input value={f.subtitle} maxLength={160} onChange={(e) => setF({ ...f, subtitle: e.target.value })} placeholder="Peças únicas, selecionadas para você." /></div>
        <div><Label className="text-xs">Link (opcional)</Label><Input value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} placeholder="/explorar" /></div>
        <div><Label className="text-xs">Texto do botão (opcional)</Label><Input value={f.cta_label} maxLength={40} onChange={(e) => setF({ ...f, cta_label: e.target.value })} placeholder="Ver peças" /></div>
        <div className="sm:col-span-2"><Label className="text-xs">Descrição da imagem (acessibilidade)</Label><Input value={f.alt} onChange={(e) => setF({ ...f, alt: e.target.value })} /></div>
      </div>
      <div className="flex md:flex-col items-center gap-2">
        <label className="flex items-center gap-2 text-xs"><Switch checked={b.is_active} disabled={busy} onCheckedChange={(v) => save({ is_active: v })} /> {b.is_active ? "Ativo" : "Inativo"}</label>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" disabled={first} onClick={() => onMove(-1)} aria-label="Mover para cima"><ArrowUp className="w-4 h-4" /></Button>
          <Button size="icon" variant="outline" disabled={last} onClick={() => onMove(1)} aria-label="Mover para baixo"><ArrowDown className="w-4 h-4" /></Button>
        </div>
        <Button size="sm" onClick={() => save()} disabled={busy} className="bg-gold text-ink hover:bg-gold/90"><Save className="w-4 h-4 mr-1" /> Guardar</Button>
        <Button size="sm" variant="ghost" onClick={onRemove} className="text-destructive"><Trash2 className="w-4 h-4 mr-1" /> Remover</Button>
      </div>
    </div>
  );
}
