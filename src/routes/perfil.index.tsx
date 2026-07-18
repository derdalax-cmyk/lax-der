import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield, LogOut, Pencil, Save, X, Phone, MapPin, Mail, Crown,
  Heart, ShoppingBag, ChevronRight, Store, FileText, Instagram, Facebook, MessageCircle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSeller } from "@/hooks/useSeller";
import coverAsset from "@/assets/profile-cover.jpg.asset.json";

export const Route = createFileRoute("/perfil/")({
  head: () => ({ meta: [{ title: "Perfil · DERDALAX" }, { name: "description", content: "O seu perfil." }] }),
  component: Perfil,
});

function Perfil() {
  const { user, profile, isAdmin, loading, signOut, refreshProfile } = useAuth();
  const { isApproved: isSeller } = useSeller();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", city: "" });

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  const { data: full, refetch } = useQuery({
    queryKey: ["my-profile-extra", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_vip, created_at")
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

          {/* Seller panel CTA — approved sellers only */}
          {isSeller && (
            <Link
              to="/vendedor"
              className="mt-3 group flex items-center justify-between gap-3 rounded-2xl bg-green text-white px-5 py-4 hover:bg-green/90 transition-colors"
            >
              <span className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
                  <Store className="w-5 h-5 text-white" />
                </span>
                <span>
                  <span className="block font-semibold">Painel do Vendedor</span>
                  <span className="block text-xs text-white/70">Gerir os produtos da sua loja</span>
                </span>
              </span>
              <ChevronRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
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
              <Label className="text-xs">Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ex: Maputo" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={Phone} label="Telefone" value={profile?.phone} />
            <Field icon={MapPin} label="Província" value={profile?.city} />
            <Field icon={Mail} label="Email" value={profile?.email || user.email} />
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <Link to="/favoritos" className="group bg-card border border-border rounded-2xl p-5 flex items-center justify-between hover:border-gold/60 transition-colors">
          <span className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-[#c44545]" />
            </span>
            <span className="font-medium">Os meus favoritos</span>
          </span>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link to="/perfil/pedidos" className="group bg-card border border-border rounded-2xl p-5 flex items-center justify-between hover:border-gold/60 transition-colors">
          <span className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
            </span>
            <span className="font-medium">Os meus pedidos</span>
          </span>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Sobre a DERDALAX */}
      <div className="bg-card border border-border rounded-3xl mt-5 p-5 sm:p-8 shadow-sm">
        <h2 className="font-display text-lg font-semibold mb-5">Sobre a DERDALAX</h2>

        <Dialog>
          <DialogTrigger asChild>
            <button className="w-full group flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 hover:border-gold/60 transition-colors">
              <span className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                  <FileText className="w-5 h-5 text-ink" />
                </span>
                <span className="font-medium">📜 Políticas e Termos</span>
              </span>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Políticas e Termos</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 text-sm leading-relaxed">
              <section>
                <h3 className="font-semibold text-base mb-2">Política de Privacidade</h3>
                <p className="text-muted-foreground">
                  A DERDALAX respeita a sua privacidade. Recolhemos apenas os dados necessários (nome, email,
                  telefone, endereço) para processar encomendas e melhorar a experiência de compra. Os seus dados
                  nunca são partilhados com terceiros sem consentimento, exceto quando exigido por lei.
                </p>
              </section>
              <section>
                <h3 className="font-semibold text-base mb-2">Termos e Condições de Uso</h3>
                <p className="text-muted-foreground">
                  Ao utilizar a plataforma DERDALAX, concorda em fornecer informações verdadeiras, respeitar
                  vendedores e outros utilizadores, e efetuar pagamentos conforme combinado com cada loja.
                  A DERDALAX atua como intermediária entre compradores e vendedores independentes.
                </p>
              </section>
              <section>
                <h3 className="font-semibold text-base mb-2">Política de Devoluções e Trocas</h3>
                <p className="text-muted-foreground">
                  Trocas e devoluções devem ser solicitadas em até 7 dias após a receção do produto, diretamente
                  ao vendedor via chat do pedido. O produto deve estar em condições originais, sem uso.
                  Custos de envio de devolução são, regra geral, por conta do comprador, salvo defeito comprovado.
                </p>
              </section>
            </div>
          </DialogContent>
        </Dialog>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Siga-nos</div>
          <div className="flex items-center gap-3">
            <a
              href="https://instagram.com/derdalax"
              target="_blank" rel="noopener noreferrer"
              aria-label="Instagram"
              className="h-11 w-11 rounded-full bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 text-white flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://facebook.com/derdalax"
              target="_blank" rel="noopener noreferrer"
              aria-label="Facebook"
              className="h-11 w-11 rounded-full bg-[#1877F2] text-white flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <Facebook className="w-5 h-5" />
            </a>
            <a
              href="https://wa.me/258846023085"
              target="_blank" rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="h-11 w-11 rounded-full bg-[#25D366] text-white flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <MessageCircle className="w-5 h-5" />
            </a>
          </div>
        </div>
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
