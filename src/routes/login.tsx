import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isValidMzPhone } from "@/lib/validation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsLink, PrivacyLink } from "@/components/TermsLink";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar · DERDALAX" },
      { name: "description", content: "Aceda à sua conta DERDALAX." },
    ],
  }),
  component: LoginPage,
});

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.3 0-11.5-5.2-11.5-11.5S17.7 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.8 6.3 14.7z"/><path fill="#4CAF50" d="M24 43.5c4.9 0 9.4-1.9 12.8-4.9l-5.9-5c-2 1.4-4.4 2.3-6.9 2.3-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.7 39.1 16.3 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4-4.2 5.3l5.9 5c-.4.4 6.5-4.8 6.5-14.3 0-1.3-.1-2.3-.4-3.5z"/></svg>
  );
}

function PasswordInput({
  id, value, onChange, minLength, placeholder,
}: { id: string; value: string; onChange: (v: string) => void; minLength?: number; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id} type={show ? "text" : "password"} value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={minLength} required placeholder={placeholder}
        className="pr-10"
      />
      <button type="button" onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}>
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

const signupSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().email("Email inválido"),
  phone: z.string().trim().refine(isValidMzPhone, "Telefone inválido (84/85/86/87 + 7 dígitos)"),
  city: z.string().trim().min(1, "Selecione a cidade"),
  password: z.string().min(6, "Palavra-passe mínima de 6 caracteres"),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, isAdmin, refreshProfile } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: isAdmin ? "/admin" : "/" });
  }, [user, loading, isAdmin, navigate]);

  const oauth = async (provider: "google") => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    setBusy(false);
    if (res.error) toast.error(res.error.message || "Erro ao iniciar sessão");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "signup") {
        if (password !== confirm) { toast.error("As senhas não coincidem"); setBusy(false); return; }
        const parsed = signupSchema.safeParse({ name, email, phone, city, password });
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); setBusy(false); return; }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;

        // If session is created immediately (email confirmation disabled), update profile
        if (data.session) {
          await supabase.from("profiles").update({
            name, phone: phone.trim(), city,
          }).eq("id", data.user!.id);
          await refreshProfile();
          toast.success("Conta criada com sucesso!");
        } else {
          toast.success("Conta criada. Verifique o seu email para confirmar.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-secondary/40">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-[var(--shadow-elegant)] p-8 border border-border">
        <div className="text-center mb-6">
          <div className="font-display text-3xl font-bold text-ink tracking-wider">DERDALAX</div>
          <p className="text-sm text-muted-foreground mt-1">Bem-vindo de volta</p>
        </div>

        <div className="space-y-3 mb-6">
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => oauth("google")}>
            <GoogleIcon /> <span className="ml-2">Continuar com Google</span>
          </Button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={submit} className="space-y-3">
              <div><Label htmlFor="email">Email</Label><Input id="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label htmlFor="password">Palavra-passe</Label>
                <PasswordInput id="password" value={password} onChange={setPassword} />
              </div>
              <Button type="submit" className="w-full bg-gold text-ink hover:bg-gold/90" disabled={busy}>
                {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A entrar...</> : "Entrar"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={submit} className="space-y-3">
              <div><Label htmlFor="name">Nome completo *</Label>
                <Input id="name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label htmlFor="email2">Email *</Label>
                <Input id="email2" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label htmlFor="phone">Telefone (WhatsApp) *</Label>
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="84xxxxxxx" />
                {phone && !isValidMzPhone(phone) && (
                  <p className="text-xs text-destructive mt-1">Formato inválido — use 84/85/86/87 + 7 dígitos.</p>
                )}
              </div>
              <div><Label htmlFor="city">Cidade *</Label>
                <Input id="city" type="text" autoComplete="address-level2" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: Maputo" />
              </div>
              <div><Label htmlFor="password2">Palavra-passe *</Label>
                <PasswordInput id="password2" value={password} onChange={setPassword} minLength={6} placeholder="Mínimo 6 caracteres" />
              </div>
              <div><Label htmlFor="confirm">Confirmar palavra-passe *</Label>
                <PasswordInput id="confirm" value={confirm} onChange={setConfirm} minLength={6} />
                {confirm && password !== confirm && (
                  <p className="text-xs text-destructive mt-1">As senhas não coincidem</p>
                )}
              </div>
              <Button type="submit" className="w-full bg-gold text-ink hover:bg-gold/90" disabled={busy}>
                {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A criar...</> : "Criar conta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
