import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, ShoppingBag, DollarSign, Clock, TrendingUp, CalendarDays, AlertCircle,
  ArrowUpDown, ArrowUp, ArrowDown, Download, ChevronLeft, ChevronRight, Inbox, ArrowUpRight, ArrowDownRight, X,
} from "lucide-react";
import { StatusBadge, PaymentBadge, ORDER_STATUS, ORDER_STATUS_META, PAYMENT_METHOD_LABEL } from "@/components/admin/StatusBadge";
import { OrderDetailDrawer } from "@/components/admin/OrderDetailDrawer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/admin/pedidos")({
  component: AdminPedidos,
});

type OrderRow = {
  id: string;
  user_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  status: string;
  subtotal: number;
  shipping: number;
  total: number;
  created_at: string;
};

type EnrichedOrder = OrderRow & {
  seq: string;
  itemsCount: number;
  itemsLabel: string;
  customerOrders: number;
  email: string | null;
};

const money = (n: number) => `${Number(n).toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MT`;

type SortKey = "seq" | "customer_name" | "created_at" | "itemsCount" | "total" | "status";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function AdminPedidos() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const [{ data: orders, error }, { data: items }, { data: profiles }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("order_items").select("order_id, quantity, product_id"),
        supabase.from("profiles").select("id, email"),
      ]);
      if (error) throw error;

      const itemsByOrder = new Map<string, { qty: number; lines: number }>();
      (items ?? []).forEach((it) => {
        const cur = itemsByOrder.get(it.order_id) ?? { qty: 0, lines: 0 };
        cur.qty += it.quantity ?? 1;
        cur.lines += 1;
        itemsByOrder.set(it.order_id, cur);
      });
      const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

      // sequence numbers per year (ascending order)
      const asc = [...(orders ?? [])].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      const yearCounters: Record<string, number> = {};
      const seqById = new Map<string, string>();
      asc.forEach((o) => {
        const year = new Date(o.created_at).getFullYear();
        yearCounters[year] = (yearCounters[year] ?? 0) + 1;
        seqById.set(o.id, `#DER-${year}-${String(yearCounters[year]).padStart(3, "0")}`);
      });

      const ordersByUser: Record<string, number> = {};
      (orders ?? []).forEach((o) => { ordersByUser[o.user_id] = (ordersByUser[o.user_id] ?? 0) + 1; });

      const enriched: EnrichedOrder[] = (orders ?? []).map((o) => {
        const agg = itemsByOrder.get(o.id) ?? { qty: 0, lines: 0 };
        return {
          ...(o as OrderRow),
          seq: seqById.get(o.id) ?? "#DER",
          itemsCount: agg.qty,
          itemsLabel: agg.lines > 0 ? `${agg.qty} item(s) · ${agg.lines} linha(s)` : "—",
          customerOrders: ordersByUser[o.user_id] ?? 1,
          email: emailById.get(o.user_id) ?? null,
        };
      });
      return enriched;
    },
  });

  const orders = data ?? [];

  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const inMonth = (d: Date, from: Date, to: Date) => d >= from && d < to;

    const paid = (o: EnrichedOrder) => o.payment_status === "paid" || o.status === "paid" || o.status === "delivered";
    const revenue = orders.filter(paid).reduce((s, o) => s + Number(o.total), 0);

    const thisMonthOrders = orders.filter((o) => new Date(o.created_at) >= thisMonth);
    const lastMonthOrders = orders.filter((o) => inMonth(new Date(o.created_at), lastMonth, thisMonth));
    const pct = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100));

    const revThis = thisMonthOrders.filter(paid).reduce((s, o) => s + Number(o.total), 0);
    const revLast = lastMonthOrders.filter(paid).reduce((s, o) => s + Number(o.total), 0);

    const completedCount = orders.filter(paid).length;
    return {
      total: orders.length,
      ordersChange: pct(thisMonthOrders.length, lastMonthOrders.length),
      revenue,
      revenueChange: pct(revThis, revLast),
      pending: orders.filter((o) => o.status === "pending").length,
      avgTicket: completedCount ? revenue / completedCount : 0,
      todayCount: orders.filter((o) => new Date(o.created_at) >= today).length,
      unpaid: orders.filter((o) => (o.payment_status ?? "pending") !== "paid" && o.status !== "cancelled" && o.status !== "delivered").length,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    const now = new Date();
    let from: Date | null = null;
    if (dateRange === "today") from = startOfDay(now);
    else if (dateRange === "7d") { from = startOfDay(now); from.setDate(from.getDate() - 7); }
    else if (dateRange === "30d") { from = startOfDay(now); from.setDate(from.getDate() - 30); }

    const q = search.trim().toLowerCase();
    const min = minVal ? Number(minVal) : null;
    const max = maxVal ? Number(maxVal) : null;

    const list = orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (method !== "all" && o.payment_method !== method) return false;
      if (from && new Date(o.created_at) < from) return false;
      if (min != null && Number(o.total) < min) return false;
      if (max != null && Number(o.total) > max) return false;
      if (q) {
        const hay = `${o.seq} ${o.customer_name ?? ""} ${o.customer_phone ?? ""} ${o.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "customer_name": cmp = (a.customer_name ?? "").localeCompare(b.customer_name ?? ""); break;
        case "created_at": cmp = +new Date(a.created_at) - +new Date(b.created_at); break;
        case "itemsCount": cmp = a.itemsCount - b.itemsCount; break;
        case "total": cmp = Number(a.total) - Number(b.total); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "seq": cmp = a.seq.localeCompare(b.seq); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [orders, search, status, method, dateRange, minVal, maxVal, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const exportCsv = () => {
    const headers = ["Pedido", "Cliente", "Telefone", "Email", "Data", "Itens", "Subtotal", "Frete", "Total", "Status", "Pagamento", "Metodo"];
    const rows = filtered.map((o) => [
      o.seq, o.customer_name ?? "", o.customer_phone ?? "", o.email ?? "",
      new Date(o.created_at).toLocaleString("pt-PT"), o.itemsCount,
      o.subtotal, o.shipping, o.total,
      ORDER_STATUS_META[o.status]?.label ?? o.status,
      (o.payment_status ?? "pending") === "paid" ? "Pago" : "Não pago",
      PAYMENT_METHOD_LABEL[o.payment_method ?? ""] ?? o.payment_method ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-4 py-3", className)}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        {children}
        {sortKey === k ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gestão e acompanhamento de encomendas.</p>
        </div>
        <Button onClick={exportCsv} variant="outline">
          <Download className="w-4 h-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total de Pedidos" value={stats.total} icon={ShoppingBag} change={stats.ordersChange} />
        <StatCard label="Faturamento" value={money(stats.revenue)} icon={DollarSign} change={stats.revenueChange} />
        <StatCard label="Pendentes" value={stats.pending} icon={Clock} accent />
        <StatCard label="Ticket Médio" value={money(stats.avgTicket)} icon={TrendingUp} />
        <StatCard label="Pedidos Hoje" value={stats.todayCount} icon={CalendarDays} />
        <StatCard label="Por Pagar" value={stats.unpaid} icon={AlertCircle} accent />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Pesquisar nº, cliente, email, telefone…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos estados</SelectItem>
            {ORDER_STATUS.map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={method} onValueChange={(v) => { setMethod(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Pagamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos métodos</SelectItem>
            <SelectItem value="e-mpesa">M-Pesa</SelectItem>
            <SelectItem value="e-mola">E-Mola</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Data" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer data</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" value={minVal} onChange={(e) => { setMinVal(e.target.value); setPage(1); }} placeholder="Min MT" className="w-[110px]" />
        <Input type="number" value={maxVal} onChange={(e) => { setMaxVal(e.target.value); setPage(1); }} placeholder="Max MT" className="w-[110px]" />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <SortHeader k="seq">Pedido</SortHeader>
                <SortHeader k="customer_name">Cliente</SortHeader>
                <SortHeader k="created_at">Data</SortHeader>
                <SortHeader k="itemsCount">Itens</SortHeader>
                <SortHeader k="total" className="text-right">Total</SortHeader>
                <SortHeader k="status">Status</SortHeader>
                <th className="px-4 py-3">Pagamento</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">A carregar…</td></tr>}
              {!isLoading && paged.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center">
                  <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <div className="text-muted-foreground">Nenhum pedido encontrado.</div>
                </td></tr>
              )}
              {paged.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-secondary/40">
                  <td className="px-4 py-3 font-mono font-medium text-xs">{o.seq}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.customer_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.customer_phone ?? "—"}
                      {o.customerOrders > 1 && <span className="ml-1 text-gold">· {o.customerOrders}º pedido</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(o.created_at).toLocaleDateString("pt-PT")}
                    <div className="text-xs">{new Date(o.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{o.itemsLabel}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-semibold">{money(o.total)}</div>
                    <div className="text-[11px] text-muted-foreground">frete {money(o.shipping)}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <PaymentBadge status={o.payment_status} />
                      <span className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABEL[o.payment_method ?? ""] ?? "—"}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Mostrar</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[80px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <span>de {filtered.length} pedidos</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Página {safePage} de {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, change, accent }: {
  label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; change?: number; accent?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase text-muted-foreground tracking-wider">{label}</div>
        <Icon className={cn("w-4 h-4", accent ? "text-destructive" : "text-gold")} />
      </div>
      <div className="font-display text-2xl leading-tight">{value}</div>
      {change != null && (
        <div className={cn("mt-1 inline-flex items-center gap-0.5 text-xs", change >= 0 ? "text-success" : "text-destructive")}>
          {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change)}% <span className="text-muted-foreground ml-0.5">vs mês anterior</span>
        </div>
      )}
    </div>
  );
}
