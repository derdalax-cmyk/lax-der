import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatMZN } from "@/components/ProductCard";
import { RateSellerModal } from "@/components/RateSellerModal";
import { Copy, CheckCircle2, Smartphone, Clock, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pedido/$id")({
  head: () => ({ meta: [{ title: "Pedido · DERDALAX" }] }),
  component: PedidoPage,
});

type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  subtotal: number; shipping: number; total: number;
  payment_method: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  payment_phone: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: unknown;
  created_at: string;
};

type ItemRow = {
  id: string;
  quantity: number;
  price: number;
  product_id: string | null;
  variation_id: string | null;
  product?: { title: string; images: unknown; seller?: { id: string; store_name: string; logo_url: string | null } | null } | null;
};

const PAYMENT_TARGETS = {
  "e-mpesa": "+258 84 0000 000",
  "e-mola": "+258 86 0000 000",
};

function PedidoPage() {
  const { id } = useParams({ from: "/pedido/$id" });
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateTarget, setRateTarget] = useState<{ id: string; store_name: string; logo_url: string | null } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      const [{ data: o }, { data: its }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("order_items")
          .select("id,quantity,price,product_id,variation_id, product:products(title,images, seller:sellers(id,store_name,logo_url))")
          .eq("order_id", id),
      ]);
      if (!active) return;
      setOrder(o as OrderRow | null);
      setItems((its ?? []) as ItemRow[]);
      setLoading(false);
    };
    load();
    // Poll while awaiting payment confirmation
    const iv = setInterval(() => {
      setOrder((curr) => {
        if (curr && curr.payment_status !== "paid" && curr.payment_status !== "failed") load();
        return curr;
      });
    }, 5000);
    return () => { active = false; clearInterval(iv); };
  }, [id, user, authLoading]);

  if (loading || authLoading) return <div className="max-w-2xl mx-auto px-5 py-20 text-center text-muted-foreground">A carregar pedido…</div>;
  if (!order) return <div className="max-w-2xl mx-auto px-5 py-20 text-center">Pedido não encontrado. <Link to="/produtos" className="text-gold underline">Voltar à loja</Link></div>;

  const isPaid = order.payment_status === "paid";
  const target = PAYMENT_TARGETS[(order.payment_method ?? "e-mpesa") as keyof typeof PAYMENT_TARGETS];

  const sellers = useMemo(() => {
    const map = new Map<string, { id: string; store_name: string; logo_url: string | null }>();
    items.forEach((it) => {
      const s = it.product?.seller;
      if (s?.id) map.set(s.id, s);
    });
    return [...map.values()];
  }, [items]);

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado"); };

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 md:py-14 space-y-6">
      <header className="text-center space-y-2">
        <div className="inline-flex w-14 h-14 rounded-full bg-success/10 items-center justify-center text-success">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h1 className="font-display text-3xl">Pedido recebido!</h1>
        <p className="text-muted-foreground text-sm">Referência: <span className="font-mono font-medium text-foreground">{order.payment_reference}</span></p>
      </header>

      {!isPaid && (
        <section className="bg-card border border-gold/40 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-gold" />
            <div>
              <h2 className="font-display text-xl">Pagamento via {order.payment_method === "e-mola" ? "e-Mola" : "e-Mpesa"}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" /> Aguardando confirmação
              </p>
            </div>
          </div>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-semibold text-gold">1.</span>
              <div>Aceda à app <span className="font-medium">{order.payment_method === "e-mola" ? "e-Mola" : "M-Pesa"}</span> ou marque o USSD do seu operador.</div>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-gold">2.</span>
              <div className="flex-1">
                Envie <span className="font-semibold">{formatMZN(order.total)}</span> para:
                <div className="mt-1 flex items-center gap-2 bg-secondary rounded px-3 py-2 font-mono">
                  <span className="flex-1">{target}</span>
                  <button onClick={() => copy(target)} className="text-muted-foreground hover:text-foreground"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-gold">3.</span>
              <div className="flex-1">
                Indique a referência no campo de mensagem:
                <div className="mt-1 flex items-center gap-2 bg-secondary rounded px-3 py-2 font-mono">
                  <span className="flex-1">{order.payment_reference}</span>
                  <button onClick={() => copy(order.payment_reference ?? "")} className="text-muted-foreground hover:text-foreground"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-gold">4.</span>
              <div>Após confirmar, o seu pedido entra em processamento. Receberá notificação por email.</div>
            </li>
          </ol>
        </section>
      )}

      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-display text-xl mb-4">Itens</h2>
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between text-sm">
              <span>{it.product?.title ?? "Produto"} × {it.quantity}</span>
              <span className="text-muted-foreground">{formatMZN(Number(it.price) * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border mt-4 pt-4 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMZN(Number(order.subtotal))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Frete</span><span>{Number(order.shipping) === 0 ? "Grátis" : formatMZN(Number(order.shipping))}</span></div>
          <div className="flex justify-between font-medium text-lg pt-2 border-t border-border mt-2"><span>Total</span><span>{formatMZN(Number(order.total))}</span></div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link to="/produtos" className="border border-border rounded-md px-5 py-2.5 text-sm hover:bg-secondary">Continuar a comprar</Link>
        <Link to="/perfil" className="bg-gold text-ink rounded-md px-5 py-2.5 text-sm font-medium hover:bg-gold/90">Os meus pedidos</Link>
      </div>
    </div>
  );
}
