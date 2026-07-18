import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ShoppingBag, Search, TrendingUp, Clock, ChevronDown, Package, Loader2, Truck,
  MapPin, Phone, User as UserIcon, CheckCircle2, XCircle, PlayCircle, Inbox, Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos · Admin DERDALAX" }, { name: "description", content: "Todos os pedidos da loja." }] }),
  component: AdminPedidos,
});

type OrderRow = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: Record<string, string> | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  total: number;
  created_at: string;
};
type SellerPart = {
  id: string;
  order_id: string;
  seller_id: string;
  status: string;
  subtotal: number;
  tracking_code: string | null;
  notes: string | null;
  seller?: { store_name: string; logo_url: string | null; phone: string | null } | null;
  items?: { title: string | null; quantity: number; price: number }[];
};

const mzn = (n: number) => `${Number(n || 0).toLocaleString("pt-PT")} MT`;

type Stage = "received" | "processing" | "done";
function stageOf(s: string): Stage {
  if (s === "pending") return "received";
  if (s === "processing" || s === "sent") return "processing";
  return "done";
}
const STAGE_META: Record<Stage, { label: string; short: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  received: { label: "Pedido recebido", short: "Recebido", cls: "bg-gold/15 text-ink border-gold/40", icon: Inbox },
  processing: { label: "Em processamento", short: "Em processo", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30", icon: PlayCircle },
  done: { label: "Concluído", short: "Concluído", cls: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
};

function AdminPedidos() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | Stage>("all");
  const [detail, setDetail] = useState<OrderRow | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_name, customer_phone, shipping_address, status, payment_status, payment_method, total, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (search) {
        const q = search.toLowerCase();
        const hit =
          (o.customer_name ?? "").toLowerCase().includes(q) ||
          (o.customer_phone ?? "").toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (stageFilter !== "all" && stageOf(o.status) !== stageFilter) return false;
      return true;
    });
  }, [orders, search, stageFilter]);

  const stats = useMemo(() => {
    const total = orders.length;
    const revenue = orders.reduce((a, o) => a + Number(o.total || 0), 0);
    const pending = orders.filter((o) => stageOf(o.status) !== "done").length;
    return { total, revenue, pending };
  }, [orders]);

  const statCards = [
    { label: "Total de pedidos", value: stats.total, icon: ShoppingBag, cls: "bg-ink/5 text-ink" },
    { label: "Faturamento", value: mzn(stats.revenue), icon: TrendingUp, cls: "bg-green/10 text-green" },
    { label: "Em curso", value: stats.pending, icon: Clock, cls: "bg-gold/15 text-gold" },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Todos os pedidos da plataforma. Cada parte é gerida pelo respetivo vendedor; o admin pode intervir.</p>
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
            <SelectItem value="done">3 · Concluído</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="h-56 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-4 py-16 text-center text-muted-foreground">
          <ShoppingBag className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {filtered.map((o) => {
            const stage = stageOf(o.status);
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
                <span className="text-sm font-semibold shrink-0">{mzn(Number(o.total))}</span>
                <span className={cn("text-[11px] px-2 py-1 rounded-full border shrink-0", meta.cls)}>{meta.short}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 -rotate-90" />
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {detail && <AdminOrderDetail order={detail} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-orders"] })} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminOrderDetail({ order, onChanged }: { order: OrderRow; onChanged: () => void }) {
  const qc = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ["admin-order-parts", order.id],
    queryFn: async () => {
      const { data: os, error } = await supabase
        .from("order_sellers")
        .select("id, order_id, seller_id, status, subtotal, tracking_code, notes, sellers ( store_name, logo_url, phone )")
        .eq("order_id", order.id);
      if (error) throw error;
      const { data: items } = await supabase
        .from("order_items")
        .select("quantity, price, products ( title, seller_id )")
        .eq("order_id", order.id);
      const byS: Record<string, { title: string | null; quantity: number; price: number }[]> = {};
      (items ?? []).forEach((it) => {
        const sid = (it.products as { seller_id: string | null } | null)?.seller_id ?? "";
        if (!sid) return;
        (byS[sid] ||= []).push({ title: (it.products as { title: string } | null)?.title ?? null, quantity: it.quantity, price: Number(it.price) });
      });
      return (os ?? []).map((p) => ({
        ...p,
        seller: p.sellers as SellerPart["seller"],
        items: byS[p.seller_id] ?? [],
      })) as SellerPart[];
    },
  });

  const update = async (orderId: string, next: string) => {
    setSavingId(next);
    const { error } = await supabase.rpc("set_order_seller_status", { _order_id: orderId, _status: next });
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("Estado atualizado.");
    await qc.invalidateQueries({ queryKey: ["admin-order-parts", order.id] });
    onChanged();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Pedido #{order.id.slice(0, 8).toUpperCase()}</DialogTitle>
        <DialogDescription>Fluxo em 3 etapas por loja: recebido → em processo → concluído.</DialogDescription>
      </DialogHeader>

      <section className="bg-secondary/40 rounded-lg p-4 text-sm grid sm:grid-cols-2 gap-2">
        <p className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5" /> <strong>{order.customer_name ?? "—"}</strong></p>
        {order.customer_phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {order.customer_phone}</p>}
        {order.city && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {order.city}</p>}
        <p className="text-muted-foreground">Pagamento: {order.payment_method ?? "—"} · <strong>{order.payment_status ?? "—"}</strong></p>
        <p className="sm:col-span-2 font-semibold">Total: {mzn(order.total)}</p>
      </section>

      {isLoading ? (
        <div className="h-32 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : parts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sem lojas associadas.</p>
      ) : (
        <div className="space-y-4 mt-3">
          {parts.map((p) => {
            const stage = stageOf(p.status);
            return (
              <div key={p.id} className="border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary overflow-hidden grid place-items-center">
                    {p.seller?.logo_url ? <img src={p.seller.logo_url} alt="" className="w-full h-full object-cover" /> : <Store className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.seller?.store_name ?? "Loja"}</p>
                    {p.seller?.phone && <p className="text-xs text-muted-foreground">{p.seller.phone}</p>}
                  </div>
                  <span className="text-sm font-semibold">{mzn(p.subtotal)}</span>
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-2 mb-3">
                  {(["received", "processing", "done"] as Stage[]).map((s, i) => {
                    const active = (["received", "processing", "done"] as Stage[]).indexOf(stage) >= i;
                    const meta = STAGE_META[s];
                    const Icon = meta.icon;
                    return (
                      <div key={s} className="flex-1 flex items-center gap-2">
                        <div className={cn("flex items-center gap-2 flex-1 px-3 py-1.5 rounded-lg border text-xs font-semibold",
                          active ? meta.cls : "border-border text-muted-foreground bg-secondary/40")}>
                          <span className="text-[11px] font-bold">{i + 1}</span>
                          <Icon className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{meta.label}</span>
                        </div>
                        {i < 2 && <div className={cn("h-0.5 w-3 rounded", active ? "bg-gold" : "bg-secondary")} />}
                      </div>
                    );
                  })}
                </div>

                {p.items && p.items.length > 0 && (
                  <ul className="text-sm space-y-1 mb-3">
                    {p.items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Package className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <span className="flex-1">{it.title}<span className="text-muted-foreground"> × {it.quantity}</span></span>
                        <span className="font-medium shrink-0">{mzn(it.price * it.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {p.tracking_code && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Truck className="w-3.5 h-3.5" /> Rastreio: <strong className="text-foreground">{p.tracking_code}</strong>
                  </p>
                )}
                {p.notes && <p className="text-xs text-muted-foreground italic mb-2">"{p.notes}"</p>}

                <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-border">
                  {stage === "received" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => update(p.order_id, "cancelled")} disabled={!!savingId} className="text-destructive border-destructive/40 hover:bg-destructive/10">
                        <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                      </Button>
                      <Button size="sm" onClick={() => update(p.order_id, "processing")} disabled={!!savingId} className="bg-ink text-gold hover:bg-ink/90">
                        <PlayCircle className="w-4 h-4 mr-1" /> Iniciar
                      </Button>
                    </>
                  )}
                  {stage === "processing" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => update(p.order_id, "cancelled")} disabled={!!savingId} className="text-destructive border-destructive/40 hover:bg-destructive/10">
                        <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                      </Button>
                      <Button size="sm" onClick={() => update(p.order_id, "delivered")} disabled={!!savingId} className="bg-success text-white hover:bg-success/90">
                        {savingId === "delivered" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                        Concluir
                      </Button>
                    </>
                  )}
                  {stage === "done" && (
                    <span className={cn("text-xs px-3 py-1 rounded-full border",
                      p.status === "cancelled" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-success/10 text-success border-success/30")}>
                      {p.status === "cancelled" ? "Rejeitado" : "Concluído"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
