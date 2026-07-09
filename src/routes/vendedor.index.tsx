import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeller } from "@/hooks/useSeller";
import {
  Package, Clock, CheckCircle2, TrendingUp, Plus, ShoppingBag, Star, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/vendedor/")({
  component: SellerDashboard,
});

type Dashboard = {
  error?: string;
  month_revenue: number;
  month_orders: number;
  pending_orders: number;
  avg_rating: number | null;
  total_reviews: number | null;
  top_products: { title: string; qty: number }[];
  daily: { day: string; revenue: number }[];
  category_sales: { category: string; revenue: number }[];
  recent_orders: { id: string; customer_name: string | null; total: number; status: string; created_at: string }[];
  low_stock: { title: string; size: string | null; color: string | null; stock: number }[];
};

const mzn = (n: number) => `${Number(n || 0).toLocaleString("pt-PT")} MT`;

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-gold/15 text-gold" },
  paid: { label: "Pago", cls: "bg-success/15 text-success" },
  processing: { label: "A processar", cls: "bg-ink/5 text-ink" },
  sent: { label: "Enviado", cls: "bg-green/10 text-green" },
  delivered: { label: "Entregue", cls: "bg-success/15 text-success" },
  cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
};

function SellerDashboard() {
  const { seller } = useSeller();

  const { data: dash } = useQuery({
    queryKey: ["seller-dashboard", seller?.id],
    enabled: !!seller?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_dashboard");
      if (error) throw error;
      return data as unknown as Dashboard;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["seller-products-counts", seller?.id],
    enabled: !!seller?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("id,approval_status,status")
        .eq("seller_id", seller!.id);
      if (error) throw error;
      return data as { id: string; approval_status: string; status: string }[];
    },
  });

  const list = products ?? [];
  const total = list.length;
  const pending = list.filter((p) => p.approval_status === "pending").length;
  const approved = list.filter((p) => p.approval_status === "approved").length;

  const daily = dash?.daily ?? [];
  const maxDaily = Math.max(1, ...daily.map((d) => Number(d.revenue)));

  const stats = [
    { label: "Faturamento do mês", value: mzn(dash?.month_revenue ?? 0), icon: TrendingUp, cls: "bg-green/10 text-green" },
    { label: "Pedidos do mês", value: dash?.month_orders ?? 0, icon: ShoppingBag, cls: "bg-ink/5 text-ink" },
    { label: "Pedidos pendentes", value: dash?.pending_orders ?? 0, icon: Clock, cls: "bg-gold/15 text-gold" },
    { label: "Avaliação", value: dash?.avg_rating ? `${Number(dash.avg_rating).toFixed(1)} ★` : "—", icon: Star, cls: "bg-gold/15 text-gold" },
    { label: "Produtos ativos", value: `${approved}/${total}`, icon: Package, cls: "bg-success/10 text-success" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Olá, {seller?.full_name?.split(" ")[0] ?? "vendedor"} 👋</h1>
          <p className="text-sm text-muted-foreground">Visão geral da sua loja <strong>{seller?.store_name}</strong>.</p>
        </div>
        <Button asChild className="bg-gold text-ink hover:bg-gold/90">
          <Link to="/vendedor/produtos"><Plus className="w-4 h-4 mr-1" /> Adicionar produto</Link>
        </Button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {stats.map((s) => {
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

      {pending > 0 && (
        <div className="mb-6 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-gold shrink-0" />
          Tem <strong>{pending}</strong> produto(s) à espera de aprovação do administrador.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* REVENUE CHART */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Faturamento (últimos 30 dias)</h2>
            <TrendingUp className="w-4 h-4 text-green" />
          </div>
          {daily.length === 0 || maxDaily <= 1 ? (
            <div className="h-56 grid place-items-center text-sm text-muted-foreground">Sem vendas registadas ainda.</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--gold))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--gold))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(v) => String(v).slice(8)} fontSize={11} tickLine={false} axisLine={false} interval={4} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)} />
                  <Tooltip
                    formatter={(v) => [mzn(Number(v)), "Faturamento"]}
                    labelFormatter={(l) => `Dia ${String(l).slice(8)}`}
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--gold))" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* TOP PRODUCTS */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-3">Mais vendidos</h2>
          {(dash?.top_products ?? []).length === 0 ? (
            <div className="h-56 grid place-items-center text-sm text-muted-foreground text-center px-4">Ainda sem vendas.</div>
          ) : (
            <ul className="space-y-3">
              {dash!.top_products.map((t, i) => (
                <li key={t.title + i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-ink text-gold text-xs font-bold grid place-items-center shrink-0">{i + 1}</span>
                  <span className="flex-1 truncate text-sm">{t.title}</span>
                  <span className="text-sm font-semibold">{t.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RECENT ORDERS */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Pedidos recentes</h2>
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
          </div>
          {(dash?.recent_orders ?? []).length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground text-sm">Sem pedidos ainda.</div>
          ) : (
            <ul className="divide-y divide-border">
              {dash!.recent_orders.map((o) => {
                const st = STATUS_LABEL[o.status] ?? { label: o.status, cls: "bg-secondary text-foreground" };
                return (
                  <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">{o.customer_name ?? "Cliente"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-PT")}</p>
                    </div>
                    <span className="text-sm font-semibold shrink-0">{mzn(Number(o.total))}</span>
                    <span className={`text-[11px] px-2 py-1 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* LOW STOCK */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Stock baixo</h2>
            <AlertTriangle className="w-4 h-4 text-gold" />
          </div>
          {(dash?.low_stock ?? []).length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-success" />
              Stock em dia.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {dash!.low_stock.map((s, i) => (
                <li key={s.title + i} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-sm">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[s.size, s.color].filter(Boolean).join(" · ") || "Variação"}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${s.stock === 0 ? "text-destructive" : "text-gold"}`}>
                    {s.stock} un.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
