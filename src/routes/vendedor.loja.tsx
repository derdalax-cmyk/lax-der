import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeller } from "@/hooks/useSeller";
import { useAuth, MZ_PROVINCES } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { IMAGE_ACCEPT, validateUpload } from "@/lib/uploadLimits";

export const Route = createFileRoute("/vendedor/loja")({
  component: SellerLoja,
});

function SellerLoja() {
  const { seller } = useSeller();
  const { user } = useAuth();
  const qc = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    store_name: "", full_name: "", phone: "", province: "", city: "", description: "",
    emola_number: "", mpesa_number: "", bank_name: "", bank_account: "",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (seller) {
      setForm({
        store_name: seller.store_name ?? "",
        full_name: seller.full_name ?? "",
        phone: seller.phone ?? "",
        province: seller.province ?? "",
        city: seller.city ?? "",
        description: seller.description ?? "",
        emola_number: seller.emola_number ?? "",
        mpesa_number: seller.mpesa_number ?? "",
        bank_name: seller.bank_name ?? "",
        bank_account: seller.bank_account ?? "",
      });
      setLogoUrl(seller.logo_url ?? null);
    }
  }, [seller]);


  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const uploadLogo = async (file: File) => {
    const invalid = validateUpload(file, "image");
    if (invalid) { toast.error(invalid); return; }
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `sellers/${user.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast.success("Logótipo carregado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!seller) return;
    if (!form.store_name.trim() || !form.full_name.trim() || !form.phone.trim() || !form.province) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("sellers").update({
      store_name: form.store_name.trim(),
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      province: form.province,
      description: form.description.trim() || null,
      logo_url: logoUrl,
      emola_number: form.emola_number.trim() || null,
      mpesa_number: form.mpesa_number.trim() || null,
      bank_name: form.bank_name.trim() || null,
      bank_account: form.bank_account.trim() || null,
    }).eq("id", seller.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Loja atualizada");
    qc.invalidateQueries({ queryKey: ["my-seller"] });
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl mb-1">Minha loja</h1>
      <p className="text-sm text-muted-foreground mb-6">Atualize os dados da sua loja.</p>

      <div className="bg-card border border-border rounded-xl p-5 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-secondary overflow-hidden grid place-items-center shrink-0">
            {logoUrl ? <img src={logoUrl} alt="Logótipo" className="w-full h-full object-cover" /> : <Store className="w-8 h-8 text-muted-foreground" />}
          </div>
          <div>
            <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => logoInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Camera className="w-4 h-4 mr-1" />}
              Alterar logótipo
            </Button>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou WEBP, até 5MB.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Nome da loja *</Label>
            <Input type="text" value={form.store_name} onChange={(e) => set("store_name", e.target.value)} />
          </div>
          <div>
            <Label>Responsável *</Label>
            <Input type="text" autoComplete="name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </div>
          <div>
            <Label>Telefone / WhatsApp *</Label>
            <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <Label>Província *</Label>
            <Select value={form.province} onValueChange={(v) => set("province", v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                {MZ_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cidade</Label>
            <Input type="text" value={form.city} disabled readOnly placeholder="Definida pelo administrador" />
            <p className="text-xs text-muted-foreground mt-1">A cidade da sua loja é definida pela administração. É por ela que os seus produtos aparecem no seletor de cidades.</p>
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição da loja</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <h2 className="font-display text-lg mb-1">Métodos de recebimento</h2>
          <p className="text-xs text-muted-foreground mb-3">Estes dados são usados para lhe transferirmos o valor dos seus pedidos. São privados.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nº e-Mola</Label>
              <Input type="tel" inputMode="tel" value={form.emola_number} onChange={(e) => set("emola_number", e.target.value)} placeholder="+258 84 …" />
            </div>
            <div>
              <Label>Nº M-Pesa</Label>
              <Input type="tel" inputMode="tel" value={form.mpesa_number} onChange={(e) => set("mpesa_number", e.target.value)} placeholder="+258 82 …" />
            </div>
            <div>
              <Label>Banco</Label>
              <Input type="text" value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="Ex: BIM, BCI, Standard Bank" />
            </div>
            <div>
              <Label>NIB / IBAN</Label>
              <Input type="text" inputMode="numeric" value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)} placeholder="0000 0000 0000 0000" />
            </div>
          </div>
        </div>


        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-gold text-ink hover:bg-gold/90">
            {saving ? "A guardar…" : "Guardar alterações"}
          </Button>
        </div>
      </div>
    </div>
  );
}
