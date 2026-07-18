import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeller } from "@/hooks/useSeller";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ShoppingBag, Search, TrendingUp, Clock, ChevronDown, Package, Loader2, Truck,
  MapPin, Phone, User as UserIcon, CheckCircle2, XCircle, PlayCircle, Inbox, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { OrderChatPanel } from "@/components/OrderChatPanel";

export const Route = createFileRoute("/vendedor/pedidos")({
  component: SellerPedidos,
});

type OrderItem = { title: string; quantity: number; price: number; size: string | null; color: string | null };
type SellerOrder = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  city: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  seller_total: number;
  items: OrderItem[];
  seller_status?: string;
  tracking_code?: string | null;
  seller_notes?: string | null;
};
type SellerOrders = {
  error?: string;
  orders: SellerOrder[];
  stats: { total_orders: number; revenue: number; pending: number };
};

const mzn = (n: number) => `${Number(n || 0).toLocaleString("pt-PT")} MT`;

/** Map internal seller_status → 3-stage workflow. */
type Stage = "received" | "processing" | "done";
function stageOf(s: string): Stage {
  if (s === "pending") return "received";
  if (s === "processing" || s === "sent") return "processing";
  return "done"; // delivered | cancelled
}
const STAGE_META: Record<Stage, { label: string; short: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  received: { label: "Pedido recebido", short: "Recebido", cls: "bg-gold/15 text-ink border-gold/40", icon: Inbox },
  processing: { label: "Em processamento", short: "Em processo", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30", icon: PlayCircle },
  done: { label: "Concluído", short: "Concluído", cls: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
};

const SELLER_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  processing: "A processar",
  sent: "Enviado",
  delivered: "Concluído / Pago",
  cancelled: "Rejeitado",
};

function SellerPedidos() {
  const { seller } = useSeller();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | Stage>("all");
  const [detail, setDetail] = useState<SellerOrder | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["seller-orders", seller?.id],
    enabled: !!seller?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_orders");
      if (error) throw error;
      return data as unknown as SellerOrders;
    },
  });

  const orders = data?.orders ?? [];
  const stats = data?.stats ?? { total_orders: 0, revenue: 0, pending: 0 };

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const stage = stageOf(o.seller_status ?? "pending");
      if (stageFilter !== "all" && stage !== stageFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit =
          (o.customer_name ?? "").toLowerCase().includes(q) ||
          (o.customer_phone ?? "").toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [orders, search, stageFilter]);

  const updateStatus = async (orderId: string, next: string, extra?: { tracking?: string; notes?: string }) => {
    setSavingId(orderId);
    const { error } = await supabase.rpc("set_order_seller_status", {
      _order_id: orderId,
      _status: next,
      _tracking: extra?.tracking ?? null,
      _notes: extra?.notes ?? null,
    });
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("Pedido atualizado. O cliente foi notificado.");
    await qc.invalidateQueries({ queryKey: ["seller-orders"] });
    // Refresh detail with updated order
    if (detail?.id === orderId) {
      const updated = (qc.getQueryData(["seller-orders", seller?.id]) as SellerOrders | undefined)?.orders.find((o) => o.id === orderId);
      if (updated) setDetail(updated);
    }
  };

  const statCards = [
    { label: "Total de pedidos", value: stats.total_orders, icon: ShoppingBag, cls: "bg-ink/5 text-ink" },
    { label: "Faturamento", value: mzn(stats.revenue), icon: TrendingUp, cls: "bg-green/10 text-green" },
    { label: "Aguardam ação", value: stats.pending, icon: Clock, cls: "bg-gold/15 text-gold" },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Cada pedido é direcionado apenas à sua loja. Faça o cliente avançar pelas 3 etapas do fluxo.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg grid place-items-center mb-3 ${s.cls}`}><Icon className="w-4.5 h-4.5" /></div>
              <p className="text-xl font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, telefone ou nº do pedido" className="pl-9" />
        </div>
        <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as "all" | Stage)}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            <SelectItem value="received">1 · Recebido</SelectItem>
            <SelectItem value="processing">2 · Em processo</SelectItem>
            <SelectItem value="done">3 · Concluído/Rejeitado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="h-56 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-4 py-16 text-center text-muted-foreground">
          <ShoppingBag className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{orders.length === 0 ? "Ainda não recebeu pedidos." : "Nenhum pedido corresponde aos filtros."}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {filtered.map((o) => {
            const stage = stageOf(o.seller_status ?? "pending");
            const meta = STAGE_META[stage];
            const StageIcon = meta.icon;
            return (
              <button key={o.id} type="button" onClick={() => setDetail(o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors">
                <div className={cn("w-9 h-9 rounded-lg border grid place-items-center shrink-0", meta.cls)}>
                  <StageIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate text-sm">{o.customer_name ?? "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">
                    #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString("pt-PT")}
                    {o.city ? ` · ${o.city}` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold shrink-0">{mzn(Number(o.seller_total))}</span>
                <span className={cn("text-[11px] px-2 py-1 rounded-full border shrink-0", meta.cls)}>{meta.short}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 -rotate-90" />
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {detail && <OrderDetailContent order={detail} saving={savingId === detail.id} onUpdate={(status, extra) => updateStatus(detail.id, status, extra)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderDetailContent({ order, saving, onUpdate }: { order: SellerOrder; saving: boolean; onUpdate: (status: string, extra?: { tracking?: string; notes?: string }) => void }) {
  const currentStatus = order.seller_status ?? "pending";
  const stage = stageOf(currentStatus);
  const [tracking, setTracking] = useState(order.tracking_code ?? "");
  const [notes, setNotes] = useState(order.seller_notes ?? "");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Pedido #{order.id.slice(0, 8).toUpperCase()}</DialogTitle>
        <DialogDescription>Fluxo em 3 etapas: recebido → em processo → concluído.</DialogDescription>
      </DialogHeader>

      {/* Stepper */}
      <div className="mb-2">
        <div className="flex items-center gap-2">
          {(["received", "processing", "done"] as Stage[]).map((s, i) => {
            const active = (["received", "processing", "done"] as Stage[]).indexOf(stage) >= i;
            const meta = STAGE_META[s];
            const Icon = meta.icon;
            return (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={cn("flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border text-xs font-semibold",
                  active ? meta.cls : "border-border text-muted-foreground bg-secondary/40")}>
                  <div className={cn("w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold",
                    active ? "bg-white/50" : "bg-secondary")}>
                    {i + 1}
                  </div>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{meta.label}</span>
                </div>
                {i < 2 && <div className={cn("h-0.5 w-4 sm:w-6 rounded", active ? "bg-gold" : "bg-secondary")} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 text-sm">
        {/* Client info */}
        <section className="bg-secondary/40 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5" /> Cliente</p>
          <p className="font-medium">{order.customer_name ?? "—"}</p>
          {order.customer_phone && (
            <a href={`tel:${order.customer_phone}`} className="inline-flex items-center gap-1.5 mt-1 text-muted-foreground hover:text-foreground">
              <Phone className="w-3.5 h-3.5" /> {order.customer_phone}
            </a>
          )}
          {order.city && <p className="mt-1 text-muted-foreground inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {order.city}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Pagamento: {order.payment_method ?? "—"} · <strong>{order.payment_status}</strong></p>
        </section>

        {/* Items */}
        <section className="bg-secondary/40 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Seus artigos</p>
          <ul className="space-y-1.5">
            {(order.items ?? []).map((it, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-1">{it.title}
                  <span className="text-muted-foreground"> × {it.quantity}
                    {[it.size, it.color].filter(Boolean).length > 0 && ` · ${[it.size, it.color].filter(Boolean).join(" / ")}`}
                  </span>
                </span>
                <span className="font-medium shrink-0">{mzn(it.price * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-border mt-3 pt-2 font-semibold">
            <span>Subtotal desta loja</span><span>{mzn(Number(order.seller_total))}</span>
          </div>
        </section>
      </div>

      {/* Chat */}
      <section className="mt-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Chat com o cliente</p>
        <OrderChatPanel orderId={order.id} sellerId="__self__" title={order.customer_name ?? "Cliente"} />
      </section>

      {/* Management */}
      <section className="mt-4 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Envio & notas</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Código de rastreio (opcional)" />
          <Input value={SELLER_STATUS_LABEL[currentStatus] ?? currentStatus} readOnly className="bg-secondary/50" />
        </div>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas ou instruções para o cliente" rows={2} className="mt-2" />

        {/* Stage action buttons */}
        <div className="mt-3 flex flex-wrap gap-2 justify-end">
          {stage === "received" && (
            <>
              <Button variant="outline" onClick={() => onUpdate("cancelled", { tracking, notes })} disabled={saving} className="text-destructive border-destructive/40 hover:bg-destructive/10">
                <XCircle className="w-4 h-4 mr-1" /> Rejeitar pedido
              </Button>
              <Button onClick={() => onUpdate("processing", { tracking, notes })} disabled={saving} className="bg-ink text-gold hover:bg-ink/90">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-1" />}
                Iniciar processamento
              </Button>
            </>
          )}
          {stage === "processing" && (
            <>
              <Button variant="outline" onClick={() => onUpdate("processing", { tracking, notes })} disabled={saving}>Guardar alterações</Button>
              <Button variant="outline" onClick={() => onUpdate("cancelled", { tracking, notes })} disabled={saving} className="text-destructive border-destructive/40 hover:bg-destructive/10">
                <XCircle className="w-4 h-4 mr-1" /> Rejeitar
              </Button>
              <Button onClick={() => onUpdate("delivered", { tracking, notes })} disabled={saving} className="bg-success text-white hover:bg-success/90">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Confirmar pago / Concluir
              </Button>
            </>
          )}
          {stage === "done" && (
            <div className="w-full">
              <div className={cn("rounded-lg border px-4 py-3 text-sm font-medium", currentStatus === "cancelled" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-success/10 text-success border-success/30")}>
                {currentStatus === "cancelled" ? "Este pedido foi rejeitado." : "Venda confirmada com sucesso 🎉"}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
