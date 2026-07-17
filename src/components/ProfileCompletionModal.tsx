import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ProfileCompletionModal() {
  const { user, profile, needsProfileCompletion, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", city: "" });

  useEffect(() => {
    if (needsProfileCompletion && profile) {
      setForm({
        name: profile.name || "",
        phone: profile.phone || "",
        city: profile.city || "",
      });
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [needsProfileCompletion, profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name || !form.phone || !form.city) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      name: form.name,
      phone: form.phone,
      city: form.city,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Perfil completo! Boas compras.");
    await refreshProfile();
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* obrigatório */ }}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Complete o seu perfil</DialogTitle>
          <DialogDescription>
            Precisamos destes dados para podermos entregar a si. Pode editá-los depois no perfil.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="phone">Telefone (+258)</Label>
            <Input id="phone" placeholder="+258 84 000 0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ex: Maputo" required />
          </div>
          <Button type="submit" className="w-full bg-gold text-ink hover:bg-gold/90" disabled={saving}>
            {saving ? "A guardar..." : "Guardar e continuar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
