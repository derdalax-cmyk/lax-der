import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Minus, Plus, ShoppingBag, Package, CheckCircle2, ChevronRight, Store, CalendarDays, Loader2, MessageCircle } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatMZN } from "@/components/ProductCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CountdownTimer } from "@/components/cart/CountdownTimer";
import { OrderChatPanel } from "@/components/OrderChatPanel";
import { cn } from "@/lib/utils";
import { paymentLabel } from "@/lib/paymentLabel";

export const Route = createFileRoute("/carrinho")({
  head: () => ({ meta: [{ title: "Carrinho · DERDALAX" }, { name: "description", content: "O seu carrinho, pedidos em curso e histórico de compras." }] }),
  component: CarrinhoPage,
});

type OrderItem = { id: string; product_id: string | null; title: string | null; quantity: number; price: number; seller_id: string | null };
type OrderSeller = {
  id: string; store_name: string; logo_url: string | null; phone: string | null;
  status: string; tracking_code: string | null; notes: string | null; subtotal: number;
  items: { id: string; product_id: string | null; title: string | null; quantity: number; price: number }[];
};
type OrderHistory = {
  id: string; created_at: string; status: string; payment_status: string | null; payment_method: string | null;
  payment_reference: string | null; subtotal: number; shipping: number; total: number;
  customer_name: string | null; customer_phone: string | null; shipping_address: Record<string, string> | null;
  items: OrderItem[]; sellers: OrderSeller[];
};

type Tab = "cart" | "pending" | "done";

const IN_PROGRESS = new Set(["pending", "paid", "processing", "sent"]);
const COMPLETED = new Set(["delivered", "cancelled"]);

function firstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0) {
    const f = images[0];
    if (typeof f === "string") return f;
    if (f && typeof f === "object" && "url" in f) return String((f as { url: unknown }).url);
  }
  return null;
}

function CarrinhoPage() {
  const [tab, setTab] = useState<Tab>("cart");
  const { user } = useAuth();
  const { items } = useCart();

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["my-order-history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_order_history");
      if (error) throw error;
      return (data ?? []) as unknown as OrderHistory[];
    },
  });

  const pending = useMemo(() => orders.filter((o) => IN_PROGRESS.has(o.status)), [orders]);
  const done = useMemo(() => orders.filter((o) => COMPLETED.has(o.status) && (o.payment_status === "paid" || o.status === "delivered")), [orders]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-5 py-8 md:py-12">
      <h1 className="font-display text-3xl md:text-4xl mb-5">A minha carrinha</h1>
      <div className="flex flex-wrap gap-1 border-b border-border mb-6">
        <TabBtn active={tab === "cart"} onClick={() => setTab("cart")} icon={<ShoppingBag className="w-4 h-4" />} label="Carrinho" badge={items.length || undefined} />
        <TabBtn active={tab === "pending"} onClick={() => setTab("pending")} icon={<Package className="w-4 h-4" />} label="Pedidos em curso" badge={pending.length || undefined} />
        <TabBtn active={tab === "done"} onClick={() => setTab("done")} icon={<CheckCircle2 className="w-4 h-4" />} label="Compras concluídas" badge={done.length || undefined} />
      </div>

      {tab === "cart" && <CartTab />}
      {tab === "pending" && <OrdersTab orders={pending} loading={loadingOrders} emptyLabel="Não tem pedidos em curso." kind="pending" />}
      {tab === "done" && <OrdersTab orders={done} loading={loadingOrders} emptyLabel="Ainda não tem compras concluídas." kind="done" />}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
        active ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}<span>{label}</span>
      {badge != null && badge > 0 && (
        <span className={cn("min-w-5 h-5 px-1.5 grid place-items-center rounded-full text-[10px] font-bold", active ? "bg-gold text-ink" : "bg-secondary text-foreground")}>{badge}</span>
      )}
    </button>
  );
}

function CartTab() {
  const navigate = useNavigate();
  const { items, loading, subtotal, shipping, total, updateQuantity, removeItem, refresh } = useCart();

  if (loading) return <div className="py-14 text-center text-muted-foreground">A carregar carrinho…</div>;

  if (items.length === 0) {
    return (
      <div className="py-16 text-center max-w-lg mx-auto">
        <ShoppingBag className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-60" />
        <h2 className="font-display text-2xl mb-2">Carrinho vazio</h2>
        <p className="text-muted-foreground mb-5">Adicione peças ao carrinho para começar.</p>
        <Link to="/produtos" className="inline-flex bg-gold text-ink rounded-md px-5 py-2.5 font-medium hover:bg-gold/90">Explorar produtos</Link>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <ul className="lg:col-span-2 space-y-4">
        {items.map((it) => {
          const img = firstImage(it.product.images);
          const price = it.variation?.price ?? Number(it.product.base_price);
          const key = `${it.product_id}-${it.variation_id ?? "_"}`;
          return (
            <li key={key} className="flex gap-4 bg-card border border-border rounded-xl p-4">
              <Link to="/produto/$id" params={{ id: it.product_id }} className="flex-none w-24 h-32 bg-secondary rounded-md overflow-hidden">
                {img ? <img src={img} alt={it.product.title} className="w-full h-full object-cover" /> : null}
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to="/produto/$id" params={{ id: it.product_id }} className="font-medium line-clamp-1 hover:text-gold">{it.product.title}</Link>
                    {(it.variation?.size || it.variation?.color) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{[it.variation.size, it.variation.color].filter(Boolean).join(" · ")}</p>
                    )}
                    {it.product.is_unique && (
                      <span className="inline-block mt-1 text-[10px] tracking-wider bg-gold text-ink px-2 py-0.5 rounded font-semibold">PEÇA ÚNICA</span>
                    )}
                  </div>
                  <button onClick={() => removeItem(it.product_id, it.variation_id)} aria-label="Remover" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {it.product.is_unique && it.product.reserved_until && (
                  <div className="mt-2 text-xs font-medium text-gold">
                    <CountdownTimer until={it.product.reserved_until} onExpire={refresh} />
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center border border-border rounded">
                    <button disabled={it.product.is_unique} onClick={() => updateQuantity(it.product_id, it.variation_id, it.quantity - 1)} className="w-8 h-8 flex items-center justify-center disabled:opacity-30"><Minus className="w-3 h-3" /></button>
                    <span className="w-8 text-center text-sm font-medium">{it.quantity}</span>
                    <button disabled={it.product.is_unique || (!!it.variation && it.quantity >= it.variation.stock)} onClick={() => updateQuantity(it.product_id, it.variation_id, it.quantity + 1)} className="w-8 h-8 flex items-center justify-center disabled:opacity-30"><Plus className="w-3 h-3" /></button>
                  </div>
                  <p className="font-medium">{formatMZN(price * it.quantity)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <aside className="bg-card border border-border rounded-xl p-5 h-fit space-y-3">
        <h2 className="font-display text-xl mb-2">Resumo</h2>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatMZN(subtotal)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Frete</span><span>{shipping === 0 ? "Grátis" : formatMZN(shipping)}</span></div>
        <div className="flex justify-between font-medium text-lg pt-3 border-t border-border"><span>Total</span><span>{formatMZN(total)}</span></div>
        <Button onClick={() => navigate({ to: "/checkout" })} className="w-full bg-gold text-ink hover:bg-gold/90 mt-2">Finalizar compra</Button>
        <Link to="/produtos" className="block text-center text-sm text-muted-foreground hover:text-foreground">Continuar a comprar</Link>
      </aside>
    </div>
  );
}

function OrdersTab({ orders, loading, emptyLabel, kind }: { orders: OrderHistory[]; loading: boolean; emptyLabel: string; kind: "pending" | "done" }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<OrderHistory | null>(null);

  if (!user) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Inicie sessão para ver os seus pedidos. <Link to="/login" className="text-gold underline">Entrar</Link></div>;
  }
  if (loading) return <div className="py-14 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (orders.length === 0) {
    return (
      <div className="py-16 text-center">
        {kind === "pending" ? <Package className="w-10 h-10 mx-auto text-muted-foreground opacity-60 mb-3" /> : <CheckCircle2 className="w-10 h-10 mx-auto text-muted-foreground opacity-60 mb-3" />}
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <>
      <div className="space-y-4">
        {orders.map((o) => (
          <article key={o.id} className="border border-border bg-card rounded-lg overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold">Pedido #{o.id.slice(0, 8).toUpperCase()}</h2>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {new Date(o.created_at).toLocaleString("pt-PT")}</p>
              </div>
              <div className="text-right"><StatusBadge status={o.status} /><p className="font-semibold mt-2">{formatMZN(Number(o.total))}</p></div>
            </header>
            <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">{o.sellers.length} loja(s):</span>
              {o.sellers.slice(0, 3).map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1"><Store className="w-3.5 h-3.5 text-muted-foreground" />{s.store_name}</span>
              ))}
            </div>
            <footer className="px-4 sm:px-5 py-3 bg-secondary/40 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelected(o)}>Ver detalhes <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </footer>
          </article>
        ))}
      </div>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && <BuyerOrderDetails order={selected} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BuyerOrderDetails({ order }: { order: OrderHistory }) {
  const address = order.shipping_address ?? {};
  const [openChat, setOpenChat] = useState<string | null>(order.sellers[0]?.id ?? null);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Pedido #{order.id.slice(0, 8).toUpperCase()}</DialogTitle>
        <DialogDescription>Detalhes completos e chat com cada loja.</DialogDescription>
      </DialogHeader>
      <div className="space-y-5 text-sm">
        <section className="grid sm:grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-lg p-3"><p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Cliente</p><p>{order.customer_name ?? "—"}</p><p className="text-muted-foreground">{order.customer_phone ?? "—"}</p></div>
          <div className="bg-secondary/50 rounded-lg p-3"><p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Entrega</p><p>{[address.street, address.number, address.neighborhood].filter(Boolean).join(", ") || "—"}</p><p className="text-muted-foreground">{[address.city, address.province].filter(Boolean).join(", ")}</p></div>
        </section>
        <section className="border border-border rounded-lg divide-y divide-border">
          {order.sellers.map((seller) => (
            <div key={seller.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-md bg-secondary overflow-hidden grid place-items-center">{seller.logo_url ? <img src={seller.logo_url} alt={seller.store_name} className="w-full h-full object-cover" /> : <Store className="w-5 h-5 text-muted-foreground" />}</div>
                <div className="flex-1 min-w-0"><h3 className="font-semibold truncate">{seller.store_name}</h3><p className="text-xs text-muted-foreground">Estado: <StatusBadge status={seller.status} /></p></div>
                <Button size="sm" variant={openChat === seller.id ? "default" : "outline"} onClick={() => setOpenChat(openChat === seller.id ? null : seller.id)} className={openChat === seller.id ? "bg-ink text-gold hover:bg-ink/90" : ""}>
                  <MessageCircle className="w-4 h-4 mr-1" /> {openChat === seller.id ? "Fechar chat" : "Abrir chat"}
                </Button>
              </div>
              <ul className="space-y-1.5">{seller.items.map((item) => <li key={item.id} className="flex justify-between gap-3"><span>{item.title ?? "Produto"} × {item.quantity}</span><span>{formatMZN(Number(item.price) * item.quantity)}</span></li>)}</ul>
              {seller.tracking_code && <p className="mt-2 text-xs text-muted-foreground">Rastreio: <strong className="text-foreground">{seller.tracking_code}</strong></p>}
              {openChat === seller.id && (
                <div className="mt-3">
                  <OrderChatPanel orderId={order.id} sellerId={seller.id} title={`Chat com ${seller.store_name}`} />
                </div>
              )}
            </div>
          ))}
        </section>
        <section className="border-t border-border pt-3 space-y-1.5">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMZN(Number(order.subtotal))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Frete</span><span>{formatMZN(Number(order.shipping))}</span></div>
          <div className="flex justify-between font-semibold text-base pt-2"><span>Total</span><span>{formatMZN(Number(order.total))}</span></div>
          <p className="text-xs text-muted-foreground pt-1">Pagamento: {paymentLabel(order.payment_method, order.payment_status)}</p>
        </section>
      </div>
    </>
  );
}
