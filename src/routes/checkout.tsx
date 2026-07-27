import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatMZN } from "@/components/ProductCard";
import { Check, ChevronLeft, ChevronRight, Smartphone, Loader2, Truck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsLink, PrivacyLink } from "@/components/TermsLink";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout · DERDALAX" }] }),
  component: CheckoutPage,
});

type Step = 1 | 2 | 3;

type Contact = { name: string; email: string; phone: string };
type Address = {
  street: string; number: string; neighborhood: string;
  city: string; province: string; reference: string;
  building: string; apartment: string;
};
type PayMethod = "e-mpesa" | "e-mola";
type PayTiming = "antecipado" | "entrega";

const PROVINCES = ["Maputo Cidade", "Maputo Província", "Gaza", "Inhambane", "Sofala", "Manica", "Tete", "Zambézia", "Nampula", "Cabo Delgado", "Niassa"];

function genReference() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DER-${t}-${r}`;
}

function CheckoutPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { items, subtotal, shipping, total, clear, loading: cartLoading } = useCart();

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  const [contact, setContact] = useState<Contact>({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState<Address>({
    street: "", number: "", neighborhood: "", city: "", province: "",
    reference: "", building: "", apartment: "",
  });
  const [saveAddress, setSaveAddress] = useState(true);
  const [payTiming, setPayTiming] = useState<PayTiming>("antecipado");
  const [payMethod, setPayMethod] = useState<PayMethod>("e-mpesa");
  const [payPhone, setPayPhone] = useState("");

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("Inicie sessão para finalizar a compra");
      navigate({ to: "/login" });
    }
  }, [user, authLoading, navigate]);

  // Pre-fill from profile
  useEffect(() => {
    if (profile) {
      setContact((c) => ({
        name: c.name || profile.name || "",
        email: c.email || profile.email || "",
        phone: c.phone || profile.phone || "",
      }));
      setAddress((a) => ({ ...a, city: a.city || profile.city || "" }));
    }
  }, [profile]);

  // Load default address if any
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("addresses").select("*").eq("user_id", user.id)
        .order("is_default", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setAddress((a) => ({
          street: a.street ?? "", number: a.number ?? "",
          neighborhood: a.neighborhood ?? "", city: a.city ?? a.city,
          province: a.province ?? "", reference: a.reference ?? "",
          building: a.building ?? "", apartment: a.apartment ?? "",
        }));
      }
    })();
  }, [user]);

  const empty = !cartLoading && items.length === 0;

  const canStep1 = useMemo(
    () => contact.name.trim().length > 2 && /\S+@\S+\.\S+/.test(contact.email) && contact.phone.replace(/\D/g, "").length >= 9,
    [contact],
  );
  const canStep2 = useMemo(
    () => address.street.trim() && address.neighborhood.trim() && address.city.trim() && address.province.trim(),
    [address],
  );
  const canSubmit = canStep1 && canStep2 && (payTiming === "entrega" || payPhone.replace(/\D/g, "").length >= 9);

  if (authLoading || cartLoading) {
    return <div className="max-w-2xl mx-auto px-5 py-20 text-center text-muted-foreground">A carregar…</div>;
  }
  if (empty) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-20 text-center">
        <h1 className="font-display text-3xl mb-3">Carrinho vazio</h1>
        <Link to="/produtos" className="text-gold underline">Ver produtos</Link>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!user) return;
    if (!canSubmit) { toast.error("Preencha todos os campos obrigatórios"); return; }
    setSubmitting(true);
    try {
      const reference = genReference();
      const finalMethod = payTiming === "entrega" ? "entrega" : payMethod;
      // Create order
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          customer_name: contact.name,
          customer_phone: contact.phone,
          subtotal, shipping, total,
          payment_method: finalMethod as never,
          payment_status: "pending",
          payment_reference: reference,
          payment_phone: payTiming === "entrega" ? contact.phone : payPhone,
          status: "pending",
          shipping_address: address,
        })
        .select("id").single();
      if (oErr || !order) throw new Error(oErr?.message || "Falha ao criar pedido");

      // Create items
      const rows = items.map((it) => ({
        order_id: order.id,
        product_id: it.product_id,
        variation_id: it.variation_id,
        quantity: it.quantity,
        price: it.variation?.price ?? Number(it.product.base_price),
      }));
      const { error: iErr } = await supabase.from("order_items").insert(rows);
      if (iErr) throw new Error(iErr.message);

      // Finalize (mark unique sold, deduct stock)
      const { error: fErr } = await supabase.rpc("finalize_order_items", { _order_id: order.id });
      if (fErr) console.warn("finalize warning:", fErr.message);

      // Save address
      if (saveAddress) {
        await supabase.from("addresses").insert({
          user_id: user.id, is_default: true, ...address,
        });
      }

      // Update profile contact if missing
      await supabase.from("profiles").update({
        name: contact.name, phone: contact.phone, city: address.city,
      }).eq("id", user.id);

      const sellerIds = Array.from(new Set(items.map((item) => item.product.seller_id).filter((id): id is string => Boolean(id))));
      await clear();

      toast.success(payTiming === "entrega" ? "Pedido criado! Pagará ao receber o produto." : "Pedido criado com sucesso! Combine o pagamento com a loja pelo chat.");
      if (sellerIds.length === 1) {
        navigate({ to: "/chat/order/$orderId", params: { orderId: order.id }, search: { seller: sellerIds[0] } });
      } else {
        navigate({ to: "/perfil/pedidos", search: { novo: order.id } });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-10 md:py-14">
      <h1 className="font-display text-3xl md:text-4xl mb-8">Checkout</h1>

      <Stepper step={step} />

      <div className="grid lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 space-y-6">
          {step === 1 && (
            <section className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl">1. Informações pessoais</h2>
              <div>
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" type="text" autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} required />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" inputMode="email" autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+258 84 000 0000" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} required />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button disabled={!canStep1} onClick={() => setStep(2)} className="bg-gold text-ink hover:bg-gold/90">
                  Continuar <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl">2. Endereço de entrega</h2>
              <div className="grid sm:grid-cols-[1fr_120px] gap-4">
                <div>
                  <Label htmlFor="street">Rua / Avenida *</Label>
                  <Input id="street" type="text" autoComplete="address-line1" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="number">Número</Label>
                  <Input id="number" type="text" inputMode="numeric" value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="neighborhood">Bairro *</Label>
                  <Input id="neighborhood" type="text" autoComplete="address-level3" value={address.neighborhood} onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="city">Cidade *</Label>
                  <Input id="city" type="text" autoComplete="address-level2" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="Ex: Maputo" required />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Província *</Label>
                  <Select value={address.province} onValueChange={(v) => setAddress({ ...address, province: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="reference">Ponto de referência</Label>
                  <Input id="reference" type="text" placeholder="Ex: Próximo ao mercado" value={address.reference} onChange={(e) => setAddress({ ...address, reference: e.target.value })} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="building">Prédio (opcional)</Label>
                  <Input id="building" type="text" value={address.building} onChange={(e) => setAddress({ ...address, building: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="apartment">Apartamento (opcional)</Label>
                  <Input id="apartment" type="text" inputMode="numeric" value={address.apartment} onChange={(e) => setAddress({ ...address, apartment: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="accent-gold" />
                Guardar este endereço para futuras compras
              </label>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
                <Button disabled={!canStep2} onClick={() => setStep(3)} className="bg-gold text-ink hover:bg-gold/90">
                  Continuar <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="bg-card border border-border rounded-xl p-6 space-y-5">
              <h2 className="font-display text-xl">3. Confirmação e pagamento</h2>

              <div className="rounded-lg bg-secondary p-4 text-sm">
                <p className="font-medium mb-1">Entregar a {contact.name}</p>
                <p className="text-muted-foreground">{address.street} {address.number}, {address.neighborhood}</p>
                <p className="text-muted-foreground">{address.city}, {address.province}</p>
                {address.reference && <p className="text-muted-foreground">Ref: {address.reference}</p>}
                <p className="text-muted-foreground mt-2">{contact.phone} · {contact.email}</p>
              </div>

              <div>
                <Label className="mb-2 block">Quando quer pagar?</Label>
                <RadioGroup value={payTiming} onValueChange={(v) => setPayTiming(v as PayTiming)} className="grid sm:grid-cols-2 gap-3">
                  <label className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer ${payTiming === "antecipado" ? "border-gold bg-gold/5" : "border-border"}`}>
                    <RadioGroupItem value="antecipado" className="mt-0.5" />
                    <Wallet className="w-5 h-5 text-gold shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm">Pagamento antecipado</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Combine com a loja via chat (m-Pesa / e-Mola / transferência) antes do envio.</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer ${payTiming === "entrega" ? "border-gold bg-gold/5" : "border-border"}`}>
                    <RadioGroupItem value="entrega" className="mt-0.5" />
                    <Truck className="w-5 h-5 text-gold shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm">Pagamento na entrega</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Pague em dinheiro ou carteira móvel ao receber o produto.</div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {payTiming === "antecipado" && (
                <>
                  <div>
                    <Label className="mb-2 block">Método de pagamento</Label>
                    <RadioGroup value={payMethod} onValueChange={(v) => setPayMethod(v as PayMethod)} className="grid sm:grid-cols-2 gap-3">
                      {(["e-mpesa", "e-mola"] as const).map((m) => (
                        <label key={m} className={`flex items-center gap-3 border rounded-lg p-4 cursor-pointer ${payMethod === m ? "border-gold bg-gold/5" : "border-border"}`}>
                          <RadioGroupItem value={m} />
                          <Smartphone className="w-5 h-5 text-gold" />
                          <span className="font-medium uppercase tracking-wide text-sm">{m === "e-mpesa" ? "e-Mpesa" : "e-Mola"}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="payPhone">Número {payMethod === "e-mpesa" ? "e-Mpesa" : "e-Mola"} para pagamento</Label>
                    <Input id="payPhone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+258 84 000 0000" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} />
                    <p className="text-xs text-muted-foreground mt-1">Receberá instruções de pagamento após confirmar.</p>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea id="notes" rows={2} placeholder="Instruções para entrega…" />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)} disabled={submitting}><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
                <Button disabled={!canSubmit || submitting} onClick={handleSubmit} className="bg-gold text-ink hover:bg-gold/90 min-w-[180px]">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A processar…</> : <>Confirmar pedido</>}
                </Button>
              </div>
            </section>
          )}
        </div>

        <aside className="bg-card border border-border rounded-xl p-5 h-fit space-y-3">
          <h2 className="font-display text-xl mb-2">Resumo</h2>
          <ul className="space-y-2 max-h-64 overflow-auto">
            {items.map((it) => {
              const price = it.variation?.price ?? Number(it.product.base_price);
              return (
                <li key={`${it.product_id}-${it.variation_id ?? "_"}`} className="flex justify-between text-sm">
                  <span className="line-clamp-1 pr-2">{it.product.title} × {it.quantity}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{formatMZN(price * it.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatMZN(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Frete</span><span>{shipping === 0 ? "Grátis" : formatMZN(shipping)}</span></div>
            <div className="flex justify-between font-medium text-lg pt-2 border-t border-border"><span>Total</span><span>{formatMZN(total)}</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Informações", "Endereço", "Pagamento"];
  return (
    <ol className="flex items-center gap-2 sm:gap-4">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const done = step > n;
        const active = step === n;
        return (
          <li key={label} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${done ? "bg-success text-white" : active ? "bg-gold text-ink" : "bg-secondary text-muted-foreground"}`}>
              {done ? <Check className="w-4 h-4" /> : n}
            </div>
            <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"} hidden sm:inline`}>{label}</span>
            {i < labels.length - 1 && <div className={`flex-1 h-px ${done ? "bg-success" : "bg-border"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
