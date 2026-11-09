import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProvinceCityFields } from "@/components/ProvinceCityFields";
import { isValidMzMobile, toMzE164, mzNationalPart, MZ_PHONE_ERROR, sanitizeMzPhoneInput } from "@/lib/validation";
import { isMzProvince } from "@/lib/locations";
import { shouldPromptProfile } from "@/lib/profileCompletion";
import { dismissProfileCompletion } from "@/lib/profileCompletion.functions";

export function ProfileCompletionModal() {
  const { user, profile, needsProfileCompletion, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const prompted = useRef(new Set<string>());
  const dismiss = useServerFn(dismissProfileCompletion);
  const [form, setForm] = useState({ name: "", phone: "", city: "", province: "" });

  useEffect(() => {
    if (!needsProfileCompletion) { setOpen(false); return; }
    if (user && profile && !prompted.current.has(user.id) && shouldPromptProfile(profile)) {
      prompted.current.add(user.id);
      setForm({
        name: profile.name || "",
        phone: mzNationalPart(profile.phone),
        city: profile.city || "",
        province: profile.province || "",
      });
      setOpen(true);
    }
  }, [needsProfileCompletion, profile, user]);

  const close = () => {
    setOpen(false);
    void dismiss().then(() => refreshProfile()).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar o adiamento.");
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim() || !form.phone || !form.city.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (!isValidMzMobile(form.phone)) { toast.error(MZ_PHONE_ERROR); return; }
    if (!isMzProvince(form.province)) { toast.error("Selecione a província."); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      name: form.name.trim(),
      phone: toMzE164(form.phone),
      province: form.province,
      city: form.city.trim(),
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Perfil completo! Boas compras.");
    await refreshProfile();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[85dvh] overflow-y-auto rounded-lg p-4 sm:p-6" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Complete o seu perfil</DialogTitle>
          <DialogDescription>
            Adicione os seus dados para facilitar compras, entregas e atendimento. Pode fazer isso agora ou mais tarde.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" type="text" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="phone">Telefone (+258)</Label>
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="84 000 0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: sanitizeMzPhoneInput(e.target.value) })} required />
            {form.phone && !isValidMzMobile(form.phone) && <p className="text-xs text-destructive mt-1">{MZ_PHONE_ERROR}</p>}
          </div>
          <ProvinceCityFields province={form.province} city={form.city} onProvinceChange={(v) => setForm((f) => ({ ...f, province: v }))} onCityChange={(v) => setForm((f) => ({ ...f, city: v }))} />
          <Button type="submit" className="w-full bg-gold text-ink hover:bg-gold/90" disabled={saving}>
            {saving ? "A guardar..." : "Guardar e continuar"}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={close}>Agora não</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
