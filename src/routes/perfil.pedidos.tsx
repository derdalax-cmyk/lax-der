import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOrderConversation } from "@/hooks/useMessaging";
import { formatMZN } from "@/components/ProductCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarDays, ChevronRight, Loader2, MessageCircle, Package, Phone, Store, Truck } from "lucide-react";
import { toast } from "sonner";
import { paymentLabel } from "@/lib/paymentLabel";

export const Route = createFileRoute("/perfil/pedidos")({
  validateSearch: (search: Record<string, unknown>): { novo?: string } => ({
    novo: typeof search.novo === "string" ? search.novo : undefined,
  }),
  head: () => ({ meta: [
    { title: "Os meus pedidos · DERDALAX" },
    { name: "description", content: "Acompanhe as suas compras e converse com cada loja." },
  ] }),
  component: OrdersHistoryPage,
});

type OrderItem = { id: string; product_id: string | null; title: string | null; images: unknown; quantity: number; price: number; seller_id: string | null };
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

const TOUR_KEY = "derdalax_orders_tour";

function OrdersHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { novo } = Route.useSearch();
  const [tourOpen, setTourOpen] = useState(false);
  const [selected, setSelected] = useState<OrderHistory | null>(null);
  const [chatting, setChatting] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(TOUR_KEY)) setTourOpen(true);
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-order-history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_order_history");
      if (error) throw error;
      return (data ?? []) as unknown as OrderHistory[];
    },
  });

  const newOrder = useMemo(() => orders.find((order) => order.id === novo), [orders, novo]);

  const openChat = async (orderId: string, sellerId: string) => {
    setChatting(`${orderId}-${sellerId}`);
    try {
      await startOrderConversation(orderId, sellerId);
      navigate({ to: "/chat/order/$orderId", params: { orderId }, search: { seller: sellerId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o chat");
    } finally {
      setChatting(null);
    }
  };

  const dismissTour = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setTourOpen(false);
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-5 py-7 md:py-12">
      <Link to="/perfil" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5">
        <ArrowLeft className="w-4 h-4" /> Voltar ao perfil
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-7">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Os meus pedidos</h1>
          <p className="text-sm text-muted-foreground mt-1">Compras, entregas e contacto direto com cada loja.</p>
        </div>
        <span className="text-sm text-muted-foreground">{orders.length} {orders.length === 1 ? "pedido" : "pedidos"}</span>
      </div>

      {newOrder && (
        <div className="mb-5 border border-gold/50 bg-gold/10 rounded-lg px-4 py-3 text-sm">
          <strong>Pedido criado com sucesso.</strong> Como envolve várias lojas, pode acompanhar cada envio e conversar com cada vendedor aqui.
        </div>
      )}

      {isLoading ? (
        <div className="h-64 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : orders.length === 0 ? (
        <div className="border border-border bg-card rounded-lg py-16 px-5 text-center">
          <Package className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="font-display text-xl">Ainda não tem pedidos</h2>
          <Button asChild className="mt-5 bg-gold text-ink hover:bg-gold/90"><Link to="/produtos">Descobrir produtos</Link></Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isNew = order.id === novo;
            return (
              <article key={order.id} className={`border bg-card rounded-lg overflow-hidden ${isNew ? "border-gold shadow-sm" : "border-border"}`}>
                <header className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-border">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">Pedido #{order.id.slice(0, 8).toUpperCase()}</h2>
                      {isNew && <span className="text-[10px] font-bold bg-gold text-ink rounded px-1.5 py-0.5">NOVO</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {new Date(order.created_at).toLocaleString("pt-PT")}</p>
                  </div>
                  <div className="text-right"><StatusBadge status={order.status} /><p className="font-semibold mt-2">{formatMZN(Number(order.total))}</p></div>
                </header>

                <div className="px-4 sm:px-5 py-4 grid md:grid-cols-[1fr_280px] gap-5">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-2">Artigos</p>
                    <ul className="space-y-2">
                      {order.items.slice(0, 3).map((item) => (
                        <li key={item.id} className="flex justify-between gap-3 text-sm"><span className="truncate">{item.title ?? "Produto"} × {item.quantity}</span><span className="text-muted-foreground shrink-0">{formatMZN(Number(item.price) * item.quantity)}</span></li>
                      ))}
                    </ul>
                    {order.items.length > 3 && <p className="text-xs text-muted-foreground mt-2">+ {order.items.length - 3} artigo(s)</p>}
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-2">Lojas</p>
                    <div className="space-y-2">
                      {order.sellers.map((seller) => (
                        <div key={seller.id} className="flex items-center gap-2 text-sm">
                          <Store className="w-4 h-4 text-muted-foreground" /><span className="flex-1 truncate">{seller.store_name}</span>
                          <button onClick={() => openChat(order.id, seller.id)} disabled={chatting === `${order.id}-${seller.id}`} className="text-gold hover:underline">Conversar</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <footer className="px-4 sm:px-5 py-3 bg-secondary/40 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setSelected(order)}>Ver detalhes <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={tourOpen} onOpenChange={(open) => !open && dismissTour()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Acompanhe os seus pedidos</DialogTitle>
            <DialogDescription>Aqui está o histórico de todas as suas compras na DERDALAX.</DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-3">
            <p>Em cada pedido, pode:</p>
            <ul className="space-y-1.5"><li>Ver os detalhes da compra</li><li>Conversar com o vendedor da loja</li><li>Obter o número de contacto do vendedor</li><li>Acompanhar o status da entrega</li></ul>
            <p className="text-muted-foreground">Se tiver dúvidas, fale diretamente com o vendedor através do chat.</p>
          </div>
          <Button onClick={dismissTour} className="bg-gold text-ink hover:bg-gold/90">Entendi, vamos começar!</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && <OrderDetails order={selected} chatting={chatting} onChat={(sellerId) => openChat(selected.id, sellerId)} />}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function OrderDetails({ order, chatting, onChat }: { order: OrderHistory; chatting: string | null; onChat: (sellerId: string) => void }) {
  const address = order.shipping_address ?? {};
  const timeline = ["pending", "processing", "sent", "delivered"];
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Pedido #{order.id.slice(0, 8).toUpperCase()}</DialogTitle>
        <DialogDescription>Resumo completo e acompanhamento por loja.</DialogDescription>
      </DialogHeader>
      <div className="space-y-6 text-sm">
        <section>
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Estado geral</h3><StatusBadge status={order.status} /></div>
          <div className="grid grid-cols-4 gap-1">
            {timeline.map((step, index) => {
              const active = timeline.indexOf(order.status) >= index;
              return <div key={step} className="text-center"><div className={`h-1.5 rounded ${active ? "bg-gold" : "bg-secondary"}`} /><span className="text-[10px] text-muted-foreground capitalize">{step === "pending" ? "Pendente" : step === "processing" ? "Processando" : step === "sent" ? "Enviado" : "Entregue"}</span></div>;
            })}
          </div>
        </section>
        <section className="grid sm:grid-cols-2 gap-4">
          <div className="bg-secondary/50 rounded-lg p-4"><h3 className="font-semibold mb-2">Cliente</h3><p>{order.customer_name ?? "—"}</p><p className="text-muted-foreground">{order.customer_phone ?? "—"}</p></div>
          <div className="bg-secondary/50 rounded-lg p-4"><h3 className="font-semibold mb-2">Entrega</h3><p>{[address.street, address.number, address.neighborhood].filter(Boolean).join(", ") || "—"}</p><p className="text-muted-foreground">{[address.city, address.province].filter(Boolean).join(", ")}</p></div>
        </section>
        <section className="border border-border rounded-lg divide-y divide-border">
          {order.sellers.map((seller) => (
            <div key={seller.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-md bg-secondary overflow-hidden grid place-items-center">{seller.logo_url ? <img src={seller.logo_url} alt={seller.store_name} className="w-full h-full object-cover" /> : <Store className="w-5 h-5 text-muted-foreground" />}</div>
                <div className="flex-1"><h3 className="font-semibold">{seller.store_name}</h3><p className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> {seller.status}</p></div>
                <Button size="sm" onClick={() => onChat(seller.id)} disabled={chatting === `${order.id}-${seller.id}`} className="bg-ink text-gold hover:bg-ink/90"><MessageCircle className="w-4 h-4 mr-1" /> Chat</Button>
              </div>
              <ul className="space-y-1.5">{seller.items.map((item) => <li key={item.id} className="flex justify-between gap-3"><span>{item.title ?? "Produto"} × {item.quantity}</span><span>{formatMZN(Number(item.price) * item.quantity)}</span></li>)}</ul>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                {seller.tracking_code && <span>Rastreio: <strong className="text-foreground">{seller.tracking_code}</strong></span>}
                {seller.phone && <a href={`tel:${seller.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="w-3 h-3" /> {seller.phone}</a>}
              </div>
            </div>
          ))}
        </section>
        <section className="border-t border-border pt-4 space-y-1.5"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMZN(Number(order.subtotal))}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Frete</span><span>{formatMZN(Number(order.shipping))}</span></div><div className="flex justify-between font-semibold text-base pt-2"><span>Total pago</span><span>{formatMZN(Number(order.total))}</span></div><p className="text-xs text-muted-foreground pt-2">Pagamento: {paymentLabel(order.payment_method, order.payment_status)}</p></section>
      </div>
    </>
  );
}