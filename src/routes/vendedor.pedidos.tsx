import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeller } from "@/hooks/useSeller";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShoppingBag, Search, TrendingUp, Clock, ChevronDown, Package, Loader2, Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

const SELLER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-gold/15 text-gold" },
  processing: { label: "A processar", cls: "bg-ink/5 text-ink" },
  sent: { label: "Enviado", cls: "bg-green/10 text-green" },
  delivered: { label: "Entregue", cls: "bg-success/15 text-success" },
  cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
};


const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-gold/15 text-gold" },
  paid: { label: "Pago", cls: "bg-success/15 text-success" },
  processing: { label: "A processar", cls: "bg-ink/5 text-ink" },
  sent: { label: "Enviado", cls: "bg-green/10 text-green" },
  delivered: { label: "Entregue", cls: "bg-success/15 text-success" },
  cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
};

function SellerPedidos() {
  const { seller } = useSeller();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const updateStatus = async (orderId: string, next: string, extra?: { tracking?: string; notes?: string }) => {
    setSavingId(orderId);
    const { error } = await supabase.rpc("set_order_seller_status", {
      _order_id: orderId,
      _status: next,
      _tracking: extra?.tracking ?? tracking[orderId] ?? null,
      _notes: extra?.notes ?? notes[orderId] ?? null,
    });
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("Pedido atualizado");
    qc.invalidateQueries({ queryKey: ["seller-orders"] });
  };

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
      if (status !== "all" && o.status !== status) return false;
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
  }, [orders, search, status]);

  const statCards = [
    { label: "Total de pedidos", value: stats.total_orders, icon: ShoppingBag, cls: "bg-ink/5 text-ink" },
    { label: "Faturamento", value: mzn(stats.revenue), icon: TrendingUp, cls: "bg-green/10 text-green" },
    { label: "Pendentes", value: stats.pending, icon: Clock, cls: "bg-gold/15 text-gold" },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Pedidos que incluem produtos da sua loja.</p>
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
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, telefone ou nº do pedido"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {Object.entries(SELLER_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
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
            const st = STATUS_LABEL[o.status] ?? { label: o.status, cls: "bg-secondary text-foreground" };
            const open = expanded === o.id;
            return (
              <div key={o.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : o.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-sm">{o.customer_name ?? "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString("pt-PT")}
                      {o.city ? ` · ${o.city}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">{mzn(Number(o.seller_total))}</span>
                  <span className={`text-[11px] px-2 py-1 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-1 bg-secondary/30">
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Cliente</p>
                        <p>{o.customer_name ?? "—"}</p>
                        {o.customer_phone && <p className="text-muted-foreground">{o.customer_phone}</p>}
                        {o.city && <p className="text-muted-foreground">{o.city}</p>}
                        <p className="text-muted-foreground mt-1">
                          Pagamento: {o.payment_method ?? "—"} · {o.payment_status}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Seus artigos</p>
                        <ul className="space-y-1.5">
                          {(o.items ?? []).map((it, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Package className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                              <span className="flex-1">
                                {it.title}
                                <span className="text-muted-foreground">
                                  {" "}× {it.quantity}
                                  {[it.size, it.color].filter(Boolean).length > 0 && ` · ${[it.size, it.color].filter(Boolean).join(" / ")}`}
                                </span>
                              </span>
                              <span className="font-medium shrink-0">{mzn(it.price * it.quantity)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex justify-between border-t border-border mt-2 pt-2 font-semibold">
                          <span>Subtotal (sua loja)</span>
                          <span>{mzn(Number(o.seller_total))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
