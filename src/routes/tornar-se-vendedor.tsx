import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, MZ_PROVINCES } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Store, Rocket, Smartphone, BadgePercent, Truck, CheckCircle2, Clock,
  Loader2, Camera, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tornar-se-vendedor")({
  head: () => ({
    meta: [
      { title: "Venda na DERDALAX — Torne-se vendedor" },
      { name: "description", content: "Leve o seu negócio para o digital e chegue a mais clientes vendendo na DERDALAX." },
      { property: "og:title", content: "Venda na DERDALAX" },
      { property: "og:description", content: "Leve o seu negócio para o digital. Chegue a mais clientes." },
    ],
  }),
  component: TornarSeVendedor,
});

const benefits = [
  { icon: Rocket, title: "Mais clientes", desc: "Alcance milhares de compradores em todo o país." },
  { icon: Smartphone, title: "Gestão fácil", desc: "Painel simples para gerir produtos e pedidos." },
  { icon: BadgePercent, title: "Sem taxas (por agora)", desc: "Comece a vender sem custos iniciais." },
  { icon: Truck, title: "Entregas integradas", desc: "Logística tratada para si e para os seus clientes." },
];

const schema = z.object({
  full_name: z.string().trim().min(2, "Indique o seu nome completo").max(120),
  phone: z.string().trim().min(6, "Indique um telefone válido").max(30),
  store_name: z.string().trim().min(2, "Indique o nome da loja").max(120),
  province: z.string().trim().min(1, "Selecione a província"),
  city: z.string().trim().max(120).optional(),
  description: z.string().trim().max(400).optional(),
});

function TornarSeVendedor() {
  const { user } = useAuth();
  const logoInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "", email: "", password: "", confirm: "",
    phone: "", store_name: "", province: "", city: "", description: "",
  });
  const [accepted, setAccepted] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Existing seller record for the logged-in user
  const { data: existing, isLoading: loadingSeller } = useQuery({
    queryKey: ["my-seller", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("sellers").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, email: user.email ?? f.email }));
  }, [user]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickLogo = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Formato inválido (JPG, PNG ou WEBP)"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem maior que 5MB"); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) { toast.error("Aceite os termos e políticas para continuar"); return; }

    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

    if (!user) {
      if (form.password.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres"); return; }
      if (form.password !== form.confirm) { toast.error("As senhas não coincidem"); return; }
      if (!z.string().email().safeParse(form.email.trim()).success) { toast.error("Email inválido"); return; }
    }

    setBusy(true);
    try {
      let uid = user?.id;

      // Create account if not logged in
      if (!uid) {
        const { error: suErr } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: form.full_name } },
        });
        if (suErr) throw suErr;
        // Try to sign in to obtain a session for the insert
        const { data: signIn, error: siErr } = await supabase.auth.signInWithPassword({
          email: form.email.trim(), password: form.password,
        });
        if (siErr || !signIn.session) {
          setSubmitted(true);
          toast.success("Conta criada. Confirme o seu email e volte para concluir o cadastro.");
          setBusy(false);
          return;
        }
        uid = signIn.user.id;
      }

      // Upload logo (optional)
      let logo_url: string | null = null;
      if (logoFile && uid) {
        const ext = logoFile.name.split(".").pop();
        const path = `avatars/${uid}/seller-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("products").upload(path, logoFile, { upsert: true });
        if (!upErr) logo_url = supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase.from("sellers").insert({
        user_id: uid!,
        full_name: parsed.data.full_name,
        email: form.email.trim() || null,
        phone: parsed.data.phone,
        store_name: parsed.data.store_name,
        province: parsed.data.province,
        city: parsed.data.city || null,
        description: parsed.data.description || null,
        logo_url,
        status: "pending",
      });
      if (error) throw error;

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Already a seller → show status
  if (user && !loadingSeller && existing) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16">
        <div className="bg-card border border-border rounded-3xl p-8 text-center shadow-sm">
          {existing.status === "approved" ? (
            <>
              <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h1 className="font-display text-2xl font-bold mb-1">A sua loja está ativa</h1>
              <p className="text-muted-foreground mb-6">{existing.store_name} já pode vender na DERDALAX.</p>
              <Link to="/perfil" className="inline-flex items-center gap-2 bg-gold text-ink font-semibold px-5 py-3 rounded-xl hover:bg-gold/90 transition-colors">
                Ir para o meu perfil <ChevronRight className="w-4 h-4" />
              </Link>
            </>
          ) : existing.status === "rejected" ? (
            <>
              <div className="mx-auto h-16 w-16 rounded-2xl bg-[#c44545]/10 flex items-center justify-center mb-4">
                <Store className="w-8 h-8 text-[#c44545]" />
              </div>
              <h1 className="font-display text-2xl font-bold mb-1">Cadastro não aprovado</h1>
              <p className="text-muted-foreground">O seu cadastro foi analisado. Contacte o nosso apoio para mais informações.</p>
            </>
          ) : (
            <>
              <div className="mx-auto h-16 w-16 rounded-2xl bg-gold/15 flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-gold" />
              </div>
              <h1 className="font-display text-2xl font-bold mb-1">Cadastro recebido</h1>
              <p className="text-muted-foreground">Aguarde a aprovação da sua loja <strong>{existing.store_name}</strong>. Avisaremos por email assim que estiver ativa.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16">
        <div className="bg-card border border-border rounded-3xl p-8 text-center shadow-sm">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gold/15 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-gold" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-1">Cadastro recebido</h1>
          <p className="text-muted-foreground mb-6">Obrigado! O seu pedido foi enviado. Aguarde a aprovação — avisaremos por email assim que a sua loja estiver ativa.</p>
          <Link to="/" className="inline-flex items-center gap-2 bg-ink text-white font-semibold px-5 py-3 rounded-xl hover:bg-ink/90 transition-colors">
            Voltar à loja <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="bg-ink text-white">
        <div className="max-w-[1100px] mx-auto px-5 py-14 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-gold mb-5">
            <Store className="w-4 h-4" /> Programa de vendedores
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight">Venda na DERDALAX</h1>
          <p className="text-white/70 mt-4 text-lg max-w-2xl mx-auto">Leve o seu negócio para o digital. Chegue a mais clientes.</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 text-left">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="h-10 w-10 rounded-xl bg-gold/20 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-gold" />
                  </div>
                  <div className="font-semibold">{b.title}</div>
                  <div className="text-sm text-white/60 mt-1">{b.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="max-w-2xl mx-auto px-5 -mt-8">
        <form onSubmit={submit} className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div>
            <h2 className="font-display text-2xl font-bold">Cadastro de vendedor</h2>
            <p className="text-sm text-muted-foreground mt-1">Preencha os dados abaixo para começar.</p>
          </div>

          {/* Logo */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              className="relative h-20 w-20 rounded-2xl bg-secondary flex items-center justify-center overflow-hidden shrink-0 hover:ring-2 hover:ring-gold transition"
              aria-label="Carregar foto da loja"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera className="w-6 h-6 text-muted-foreground" />
              )}
            </button>
            <div className="text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Foto / logótipo da loja</div>
              <div>Opcional — JPG, PNG ou WEBP (máx. 5MB)</div>
            </div>
            <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => e.target.files?.[0] && pickLogo(e.target.files[0])} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-xs">Nome completo *</Label>
              <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="O seu nome" />
            </div>

            {!user && (
              <>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Email (será o seu login) *</Label>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="voce@email.com" />
                </div>
                <div>
                  <Label className="text-xs">Senha *</Label>
                  <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
                <div>
                  <Label className="text-xs">Confirmar senha *</Label>
                  <Input type="password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
                </div>
              </>
            )}

            <div>
              <Label className="text-xs">Telefone (WhatsApp) *</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+258 84 000 0000" />
            </div>
            <div>
              <Label className="text-xs">Nome da loja *</Label>
              <Input value={form.store_name} onChange={(e) => set("store_name", e.target.value)} placeholder="Ex: Moda da Maria" />
            </div>
            <div>
              <Label className="text-xs">Província *</Label>
              <Select value={form.province} onValueChange={(v) => set("province", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {MZ_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Ex: Beira" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Descrição da loja</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Conte um pouco sobre a sua loja (opcional)" rows={3} />
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} className="mt-0.5" />
            <span className="text-muted-foreground">
              Li e aceito os <Link to="/suporte" className="text-gold underline underline-offset-2">termos e políticas</Link> da DERDALAX.
            </span>
          </label>

          <Button type="submit" disabled={busy} className="w-full bg-gold text-ink hover:bg-gold/90 h-12 text-base font-semibold">
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A enviar…</> : "Enviar cadastro"}
          </Button>
        </form>
      </section>
    </div>
  );
}
