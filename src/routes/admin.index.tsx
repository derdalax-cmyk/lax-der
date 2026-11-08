import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineCounts } from "@/hooks/useOnlineCounts";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, Wifi, UserPlus,
  Store, Star, Clock, Receipt,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

type TopSeller = { store_name: string; orders_count: number; revenue: number; rating: number };
type Stats = {
  gmv_today: number;
  gmv_yesterday: number;
  orders_today: number;
  orders_pending: number;
  new_signups_today: number;
  new_sellers_today: number;
  revenue_last_14_days: { date: string; total: number }[];
  signups_last_14_days: { date: string; buyers: number; sellers: number }[];
  top_sellers: TopSeller[];
  avg_ticket_7d: number;
  sellers_pending_count: number;
};

const mzn = (n: number) => `${Number(n || 0).toLocaleString("pt-PT", { maximumFractionDigits: 0 })} MT`;
const pct = (a: number, b: number) => {
  if (!b) return a > 0 ? 100 : 0;
  return ((a - b) / b) * 100;
};

function AdminHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_dashboard_stats");
      if (error) throw error;
      return data as unknown as Stats;
    },
    refetchInterval: 60_000,
  });

  const online = useOnlineCounts();
  const revenueDelta = data ? pct(Number(data.gmv_today), Number(data.gmv_yesterday)) : 0;
  const revenueUp = revenueDelta >= 0;

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Dashboard</h1>
      <p className="text-muted-foreground mb-6">Visão em tempo real da Derdalax.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Faturamento hoje"
          value={mzn(Number(data?.gmv_today ?? 0))}
          icon={Receipt}
          hint={
            <span className={`inline-flex items-center gap-1 ${revenueUp ? "text-green-600" : "text-destructive"}`}>
              {revenueUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(revenueDelta).toFixed(1)}% vs ontem
            </span>
          }
        />
        <KpiCard
          label="Pedidos hoje"
          value={String(data?.orders_today ?? 0)}
          icon={ShoppingCart}
          hint={<span className="text-muted-foreground">{data?.orders_pending ?? 0} pendentes</span>}
        />
        <KpiCard
          label="Online agora"
          value={String(online.total)}
          icon={Wifi}
          accent
          hint={<span className="text-muted-foreground">{online.sellers} vendedores · {online.buyers} compradores</span>}
        />
        <KpiCard
          label="Novos cadastros hoje"
          value={String(data?.new_signups_today ?? 0)}
          icon={UserPlus}
          hint={<span className="text-muted-foreground">{data?.new_sellers_today ?? 0} novas lojas</span>}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Faturamento · últimos 14 dias">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.revenue_last_14_days ?? []} margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} className="text-xs" minTickGap={20} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(v: number) => mzn(v)} />
              <Line type="monotone" dataKey="total" stroke="#e4b363" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Novos cadastros · últimos 14 dias">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.signups_last_14_days ?? []} margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} className="text-xs" minTickGap={20} />
              <YAxis allowDecimals={false} className="text-xs" />
              <Tooltip />
              <Legend />
              <Bar dataKey="buyers" name="Compradores" stackId="a" fill="#1a4d2e" />
              <Bar dataKey="sellers" name="Vendedores" stackId="a" fill="#e4b363" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Star className="w-4 h-4 text-gold" />
          <span className="font-medium">Top 5 vendedores (7 dias)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Loja</th>
                <th className="px-4 py-3 text-right">Pedidos</th>
                <th className="px-4 py-3 text-right">Faturamento</th>
                <th className="px-4 py-3 text-right">Avaliação</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">A carregar…</td></tr>
              )}
              {!isLoading && (data?.top_sellers ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Sem vendas nos últimos 7 dias.</td></tr>
              )}
              {(data?.top_sellers ?? []).map((s, i) => (
                <tr key={i} className="border-t border-border hover:bg-secondary/40">
                  <td className="px-4 py-3 flex items-center gap-2">
                    <Store className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{s.store_name}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{s.orders_count}</td>
                  <td className="px-4 py-3 text-right font-medium">{mzn(Number(s.revenue))}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-gold text-gold" />
                      {Number(s.rating || 0).toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MiniCard
          label="Taxa de conversão"
          value="Em breve"
          icon={TrendingUp}
          hint="Tracking de eventos ainda não configurado"
        />
        <MiniCard
          label="Ticket médio (7 dias)"
          value={mzn(Number(data?.avg_ticket_7d ?? 0))}
          icon={Clock}
        />
        <Link to="/admin/vendedores" className="block">
          <MiniCard
            label="Vendedores pendentes"
            value={String(data?.sellers_pending_count ?? 0)}
            icon={Users}
            accent={(data?.sellers_pending_count ?? 0) > 0}
            hint="Ver aprovações →"
          />
        </Link>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, hint, accent,
}: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>;
  hint?: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={accent ? "w-4 h-4 text-gold" : "w-4 h-4 text-muted-foreground"} />
      </div>
      <div className="font-display text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs">{hint}</div>}
    </div>
  );
}

function MiniCard({
  label, value, icon: Icon, hint, accent,
}: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>;
  hint?: string; accent?: boolean;
}) {
  return (
    <div className={`bg-card border rounded-xl p-4 ${accent ? "border-gold" : "border-border"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="font-display text-2xl">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h2 className="font-medium mb-3">{title}</h2>
      {children}
    </div>
  );
}
