import { createFileRoute, Link } from "@tanstack/react-router";
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
import { TermsLink } from "@/components/TermsLink";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Store, Rocket, Smartphone, BadgePercent, Truck, CheckCircle2, Clock,
  Loader2, Camera, ChevronRight, Upload, X, Eye, EyeOff, FileText, CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { isValidMzPhone } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { validateUpload } from "@/lib/uploadLimits";

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
  phone: z.string().trim().refine(isValidMzPhone, "Telefone inválido (84/85/86/87 + 7 dígitos)"),
  store_name: z.string().trim().min(2, "Indique o nome da loja").max(120),
  province: z.string().trim().min(1, "Selecione a província"),
  description: z.string().trim().max(400).optional(),
  document_type: z.enum(["BI", "PASSAPORTE"], { message: "Selecione o tipo de documento" }),
  document_number: z.string().trim().min(4, "Número de documento inválido").max(50),
});

type DocKey = "front" | "back" | "selfie" | "face";
const DOC_LABELS: Record<DocKey, { title: string; desc: string; bucket: "seller-documents" | "seller-photos" }> = {
  front: { title: "Foto frontal do documento *", desc: "Frente do BI ou Passaporte", bucket: "seller-documents" },
  back: { title: "Foto de trás do documento *", desc: "Verso do BI (para Passaporte pode reenviar a mesma página)", bucket: "seller-documents" },
  selfie: { title: "Selfie a segurar o documento *", desc: "Rosto visível junto do documento", bucket: "seller-photos" },
  face: { title: "Foto do rosto *", desc: "Foto tipo passe, boa iluminação", bucket: "seller-photos" },
};

function FileDrop({ label, desc, value, preview, onPick, onClear }: {
  label: string; desc: string; value: File | null; preview: string | null;
  onPick: (f: File) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="border border-dashed border-border rounded-2xl p-3">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground mb-2">{desc}</div>
      {preview ? (
        <div className="relative">
          <img src={preview} alt="" className="w-full h-40 object-cover rounded-xl" />
          <button type="button" onClick={onClear}
            className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-black">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className="w-full h-40 rounded-xl bg-secondary flex flex-col items-center justify-center gap-2 hover:bg-secondary/70 transition">
          <Upload className="w-6 h-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Clique para carregar</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.currentTarget.value = ""; }} />
      {value && <div className="text-[11px] text-muted-foreground mt-1 truncate">{value.name}</div>}
    </div>
  );
}

function TornarSeVendedor() {
  const { user } = useAuth();
  const logoInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "", email: "", password: "", confirm: "",
    phone: "", store_name: "", province: "", description: "",
    document_type: "" as "" | "BI" | "PASSAPORTE",
    document_number: "",
    emola_number: "", mpesa_number: "", bank_account: "", bank_name: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<DocKey, File | null>>({ front: null, back: null, selfie: null, face: null });
  const [docPreviews, setDocPreviews] = useState<Record<DocKey, string | null>>({ front: null, back: null, selfie: null, face: null });
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  const validateImage = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Formato inválido (JPG, PNG ou WEBP)"); return false; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Imagem maior que 10MB"); return false; }
    return true;
  };

  const pickLogo = (file: File) => {
    if (!validateImage(file)) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const pickDoc = (key: DocKey, file: File) => {
    const err = validateUpload(file, "document");
    if (err) { toast.error(err); return; }
    setDocs((d) => ({ ...d, [key]: file }));
    setDocPreviews((p) => ({ ...p, [key]: URL.createObjectURL(file) }));
  };

  const clearDoc = (key: DocKey) => {
    setDocs((d) => ({ ...d, [key]: null }));
    setDocPreviews((p) => ({ ...p, [key]: null }));
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

    // Required documents
    const required: DocKey[] = ["front", "back", "selfie", "face"];
    for (const k of required) {
      if (!docs[k]) { toast.error(`Falta: ${DOC_LABELS[k].title.replace(" *", "")}`); return; }
    }

    // Check duplicate document number
    {
      const { data: dup } = await supabase.from("sellers")
        .select("id").ilike("document_number", parsed.data.document_number.trim()).maybeSingle();
      if (dup) { toast.error("Já existe um cadastro com este número de documento"); return; }
    }

    setBusy(true);
    try {
      let uid = user?.id;

      if (!uid) {
        const { error: suErr } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: form.full_name } },
        });
        if (suErr) throw suErr;
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

      // Upload logo (public bucket "products")
      let logo_url: string | null = null;
      if (logoFile && uid) {
        const ext = logoFile.name.split(".").pop();
        const path = `sellers/${uid}/logo-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("products").upload(path, logoFile, { upsert: true });
        if (!upErr) logo_url = supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
      }

      // Upload docs to private buckets, store `bucket/path`
      const uploaded: Record<DocKey, string> = { front: "", back: "", selfie: "", face: "" };
      for (const k of required) {
        const file = docs[k]!;
        const bucket = DOC_LABELS[k].bucket;
        const ext = file.name.split(".").pop();
        const path = `${uid}/${k}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        uploaded[k] = `${bucket}/${path}`;
      }

      const { error } = await supabase.from("sellers").insert({
        user_id: uid!,
        full_name: parsed.data.full_name,
        email: form.email.trim() || null,
        phone: parsed.data.phone,
        store_name: parsed.data.store_name,
        province: parsed.data.province,
        city: null,
        description: parsed.data.description || null,
        logo_url,
        status: "pending",
        document_type: parsed.data.document_type,
        document_number: parsed.data.document_number.trim(),
        document_front_url: uploaded.front,
        document_back_url: uploaded.back,
        document_selfie_url: uploaded.selfie,
        face_photo_url: uploaded.face,
        emola_number: form.emola_number.trim() || null,
        mpesa_number: form.mpesa_number.trim() || null,
        bank_account: form.bank_account.trim() || null,
        bank_name: form.bank_name.trim() || null,
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
              <Link to="/vendedor" className="inline-flex items-center gap-2 bg-gold text-ink font-semibold px-5 py-3 rounded-xl hover:bg-gold/90 transition-colors">
                Ir para o meu painel <ChevronRight className="w-4 h-4" />
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

  const phoneInvalid = form.phone.length > 0 && !isValidMzPhone(form.phone);

  return (
    <div className="pb-8">
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

      <section className="max-w-3xl mx-auto px-5 -mt-8">
        <form onSubmit={submit} className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-8">
          <div>
            <h2 className="font-display text-2xl font-bold">Cadastro de vendedor</h2>
            <p className="text-sm text-muted-foreground mt-1">Preencha os dados abaixo para começar.</p>
          </div>

          {/* Secção 1 — Dados pessoais */}
          <div className="space-y-4">
            <SectionHeader n={1} title="Dados pessoais" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-xs">Nome completo *</Label>
                <Input type="text" autoComplete="name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="O seu nome" />
              </div>
              {!user && (
                <>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Email (será o seu login) *</Label>
                    <Input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="voce@email.com" />
                  </div>
                  <div>
                    <Label className="text-xs">Senha *</Label>
                    <div className="relative">
                      <Input type={showPw ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Mínimo 6 caracteres" className="pr-10" />
                      <button type="button" onClick={() => setShowPw((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Confirmar senha *</Label>
                    <Input type={showPw ? "text" : "password"} autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
                    {form.confirm && form.password !== form.confirm && (
                      <p className="text-[11px] text-destructive mt-1">As senhas não coincidem</p>
                    )}
                  </div>
                </>
              )}
              <div>
                <Label className="text-xs">Telefone (WhatsApp) *</Label>
                <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="84xxxxxxx" className={cn(phoneInvalid && "border-destructive")} />
                {phoneInvalid && <p className="text-[11px] text-destructive mt-1">Formato inválido (84/85/86/87 + 7 dígitos)</p>}
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
              <div className="sm:col-span-2">
                <Label className="text-xs">Cidade da loja</Label>
                <Input value="Definida após aprovação pelo admin" disabled readOnly />
              </div>
            </div>
          </div>

          {/* Secção 2 — Dados da loja */}
          <div className="space-y-4">
            <SectionHeader n={2} title="Dados da loja" />
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
                <div>Opcional — JPG, PNG ou WEBP (máx. 10MB)</div>
              </div>
              <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => e.target.files?.[0] && pickLogo(e.target.files[0])} />
            </div>
            <div>
              <Label className="text-xs">Nome da loja *</Label>
              <Input type="text" value={form.store_name} onChange={(e) => set("store_name", e.target.value)} placeholder="Ex: Moda da Maria" />
            </div>
            <div>
              <Label className="text-xs">Descrição da loja</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Conte um pouco sobre a sua loja (opcional)" rows={3} />
            </div>
          </div>

          {/* Secção 3 — Documentos */}
          <div className="space-y-4">
            <SectionHeader n={3} title="Documentos de identificação" icon={FileText} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Tipo de documento *</Label>
                <Select value={form.document_type} onValueChange={(v) => set("document_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BI">Bilhete de Identidade (BI)</SelectItem>
                    <SelectItem value="PASSAPORTE">Passaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Número do documento *</Label>
                <Input type="text" value={form.document_number} onChange={(e) => set("document_number", e.target.value)} placeholder="Ex: 110101234567A" />
              </div>
              {(["front", "back", "selfie", "face"] as DocKey[]).map((k) => (
                <FileDrop key={k}
                  label={DOC_LABELS[k].title}
                  desc={DOC_LABELS[k].desc}
                  value={docs[k]} preview={docPreviews[k]}
                  onPick={(f) => pickDoc(k, f)} onClear={() => clearDoc(k)}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Os documentos são guardados de forma segura e só a administração pode visualizá-los.
            </p>
          </div>

          {/* Secção 4 — Métodos de pagamento */}
          <div className="space-y-4">
            <SectionHeader n={4} title="Métodos de pagamento (para saques)" icon={CreditCard} optional />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Número de e-Mola</Label>
                <Input type="tel" inputMode="tel" value={form.emola_number} onChange={(e) => set("emola_number", e.target.value)} placeholder="86xxxxxxx" />
              </div>
              <div>
                <Label className="text-xs">Número de M-Pesa</Label>
                <Input type="tel" inputMode="tel" value={form.mpesa_number} onChange={(e) => set("mpesa_number", e.target.value)} placeholder="84xxxxxxx" />
              </div>
              <div>
                <Label className="text-xs">Conta bancária</Label>
                <Input type="text" inputMode="numeric" value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)} placeholder="NIB / IBAN" />
              </div>
              {form.bank_account.trim() && (
                <div>
                  <Label className="text-xs">Nome do banco</Label>
                  <Input type="text" value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="Ex: BCI, Millennium, BIM" />
                </div>
              )}
            </div>
          </div>

          {/* Secção 5 — Termos */}
          <div>
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} className="mt-0.5" />
              <span className="text-muted-foreground">
                Li e aceito os <TermsLink /> da DERDALAX.
              </span>
            </label>
          </div>

          <Button type="submit" disabled={busy} className="w-full bg-gold text-ink hover:bg-gold/90 h-12 text-base font-semibold">
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A enviar…</> : "Enviar cadastro"}
          </Button>
        </form>
      </section>
    </div>
  );
}

function SectionHeader({ n, title, icon: Icon, optional }: {
  n: number; title: string; icon?: React.ComponentType<{ className?: string }>; optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-2">
      <div className="h-8 w-8 rounded-lg bg-gold/15 text-ink flex items-center justify-center font-bold text-sm">{n}</div>
      <h3 className="font-semibold flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        {title}
        {optional && <span className="text-xs text-muted-foreground font-normal">(opcional)</span>}
      </h3>
    </div>
  );
}
