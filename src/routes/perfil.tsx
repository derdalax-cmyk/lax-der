import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, MZ_PROVINCES } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, LogOut, Pencil, Save, X, Phone, MapPin, Mail, Crown,
  Heart, ShoppingBag, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import coverAsset from "@/assets/profile-cover.jpg.asset.json";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Perfil · DERDALAX" }, { name: "description", content: "O seu perfil." }] }),
  component: Perfil,
});

function Perfil() {
  const { user, profile, isAdmin, loading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", city: "", document: "" });

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  const { data: full, refetch } = useQuery({
    queryKey: ["my-profile-extra", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("document, is_vip, created_at")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    setForm({
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
      city: profile?.city ?? "",
      document: full?.document ?? "",
    });
  }, [profile, full]);

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Perfil atualizado");
    setEditing(false);
    await refreshProfile();
    refetch();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-5 py-6 sm:py-10">
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        {/* Cover */}
        <div className="relative h-36 sm:h-48">
          <img src={coverAsset.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
        </div>

        {/* Header */}
        <div className="px-5 sm:px-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-14">
            <AvatarUploader
              userId={user.id}
              avatarUrl={profile?.avatar_url ?? null}
              name={profile?.name ?? null}
              email={profile?.email ?? user.email ?? null}
              onChange={() => refreshProfile()}
            />
            <div className="flex-1 sm:pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
                  {profile?.name || "Bem-vindo"}
                </h1>
                {full?.is_vip && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gold/15 text-gold px-2 py-0.5 rounded-full">
                    <Crown className="w-3 h-3" /> VIP
                  </span>
                )}
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-600/15 text-emerald-600 px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" /> {profile?.email || user.email}
              </p>
            </div>
          </div>

          {/* Admin panel CTA — admins only */}
          {isAdmin && (
            <Link
              to="/admin"
              className="mt-5 group flex items-center justify-between gap-3 rounded-2xl bg-ink text-white px-5 py-4 hover:bg-ink/90 transition-colors"
            >
              <span className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-gold/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-gold" />
                </span>
                <span>
                  <span className="block font-semibold">Painel de Administração</span>
                  <span className="block text-xs text-white/60">Gerir produtos, pedidos e utilizadores</span>
                </span>
              </span>
              <ChevronRight className="w-5 h-5 text-gold group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      </div>

      {/* Personal data */}
      <div className="bg-card border border-border rounded-3xl mt-5 p-5 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold">Dados pessoais</h2>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4 mr-1.5" /> Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving} className="bg-gold text-ink hover:bg-gold/90">
                <Save className="w-4 h-4 mr-1.5" /> {saving ? "A guardar…" : "Guardar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-xs">Nome completo</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="O seu nome" />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+258 84 000 0000" />
            </div>
            <div>
              <Label className="text-xs">Província</Label>
              <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a província" /></SelectTrigger>
                <SelectContent>
                  {MZ_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Documento (NR/BI)</Label>
              <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="Número do documento" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={Phone} label="Telefone" value={profile?.phone} />
            <Field icon={MapPin} label="Província" value={profile?.city} />
            <Field icon={IdCard} label="Documento" value={full?.document} />
            <Field icon={Mail} label="Email" value={profile?.email || user.email} />
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <Link to="/perfil/favoritos" className="group bg-card border border-border rounded-2xl p-5 flex items-center justify-between hover:border-gold/60 transition-colors">
          <span className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-[#c44545]" />
            </span>
            <span className="font-medium">Os meus favoritos</span>
          </span>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link to="/produtos" className="group bg-card border border-border rounded-2xl p-5 flex items-center justify-between hover:border-gold/60 transition-colors">
          <span className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
            </span>
            <span className="font-medium">Continuar a comprar</span>
          </span>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      <div className="mt-6 flex justify-center">
        <Button variant="ghost" className="text-muted-foreground" onClick={() => signOut()}>
          <LogOut className="w-4 h-4 mr-1.5" /> Terminar sessão
        </Button>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 bg-secondary/40 rounded-xl px-4 py-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-medium truncate">{value || "—"}</div>
      </div>
    </div>
  );
}
