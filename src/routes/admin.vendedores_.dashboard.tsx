import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { Store, Activity, UserPlus, Ban, ArrowLeft, Star, Trophy } from "lucide-react";

export const Route = createFileRoute("/admin/vendedores_/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard de Vendedores · Admin Derdalax" }] }),
  component: SellersDashboard,
});

type SellerStat = {
  id: string; store_name: string; logo_url: string | null; city: string | null;
  province: string | null; status: string; rating: number; total_reviews: number;
  is_blocked: boolean; product_count: number; order_count: number; revenue: number;
};
type Dashboard = {
  error?: string;
  total_sellers: number;
  active_sellers: number;
  new_sellers: number;
  blocked_sellers: number;
  sellers: SellerStat[];
  sales_by_city: { city: string; revenue: number }[];
  activity: { day: string; orders: number }[];
};

const mzn = (n: number) => `${Number(n || 0).toLocaleString("pt-PT")} MT`;
const PIE_COLORS = ["#e4b363", "#1a4d2e", "#0a0a0a", "#c44545", "#8a6d3b", "#3d7a54"];

function SellersDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-sellers-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_sellers_dashboard");
      if (error) throw error;
      return data as unknown as Dashboard;
    },
  });

  const topRevenue = useMemo(
    () => [...(data?.sellers ?? [])].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    [data],
  );
  const topOrders = useMemo(
    () => [...(data?.sellers ?? [])].sort((a, b) => b.order_count - a.order_count).slice(0, 10),
    [data],
  );
  const topRated = useMemo(
    () => [...(data?.sellers ?? [])].filter((s) => s.total_reviews > 0)
      .sort((a, b) => b.rating - a.rating).slice(0, 10),
    [data],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <Link to="/admin/vendedores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="w-4 h-4" /> Vendedores
          </Link>
          <h1 className="font-display text-3xl">Dashboard de Vendedores</h1>
          <p className="text-sm text-muted-foreground">Visão geral de desempenho das lojas na Derdalax.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total de vendedores" value={data?.total_sellers ?? 0} icon={Store} />
        <StatCard label="Ativos (30 dias)" value={data?.active_sellers ?? 0} icon={Activity} accent />
        <StatCard label="Novos (30 dias)" value={data?.new_sellers ?? 0} icon={UserPlus} />
        <StatCard label="Bloqueados" value={data?.blocked_sellers ?? 0} icon={Ban} accent />
      </div>

      {isLoading && <div className="py-16 text-center text-muted-foreground">A carregar…</div>}

      {!isLoading && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <ChartCard title="Top 10 · Faturamento" icon={Trophy}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topRevenue} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <YAxis type="category" dataKey="store_name" width={110} className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => mzn(v)} />
                <Bar dataKey="revenue" fill="#e4b363" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top 10 · Pedidos" icon={Trophy}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topOrders} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis type="number" allowDecimals={false} className="text-xs" />
                <YAxis type="category" dataKey="store_name" width={110} className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="order_count" fill="#1a4d2e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top 10 · Avaliação" icon={Star}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topRated} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis type="number" domain={[0, 5]} className="text-xs" />
                <YAxis type="category" dataKey="store_name" width={110} className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="rating" fill="#c44545" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Vendas por cidade" icon={Store}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data?.sales_by_city ?? []} dataKey="revenue" nameKey="city"
                  cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={2}
                  label={(e) => e.city}
                >
                  {(data?.sales_by_city ?? []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => mzn(v)} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {!isLoading && (
        <ChartCard title="Atividade · Pedidos (últimos 30 dias)" icon={Activity} className="mb-4">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data?.activity ?? []} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} className="text-xs" minTickGap={24} />
              <YAxis allowDecimals={false} className="text-xs" />
              <Tooltip />
              <Line type="monotone" dataKey="orders" stroke="#1a4d2e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {!isLoading && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-medium">Todos os vendedores</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Loja</th>
                  <th className="px-4 py-3">Cidade</th>
                  <th className="px-4 py-3 text-right">Produtos</th>
                  <th className="px-4 py-3 text-right">Pedidos</th>
                  <th className="px-4 py-3 text-right">Faturamento</th>
                  <th className="px-4 py-3 text-right">Avaliação</th>
                </tr>
              </thead>
              <tbody>
                {(data?.sellers ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Sem vendedores.</td></tr>
                )}
                {[...(data?.sellers ?? [])].sort((a, b) => b.revenue - a.revenue).map((s) => (
                  <tr key={s.id} className="border-t border-border hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link to="/loja/$id" params={{ id: s.id }} className="flex items-center gap-3 hover:underline">
                        <div className="w-9 h-9 rounded-lg bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                          {s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : <Store className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <span className="font-medium truncate max-w-[180px]">{s.store_name}</span>
                        {s.is_blocked && <span className="text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded">Bloqueado</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.city ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{s.product_count}</td>
                    <td className="px-4 py-3 text-right">{s.order_count}</td>
                    <td className="px-4 py-3 text-right font-medium">{mzn(s.revenue)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-gold text-gold" />
                        {Number(s.rating).toFixed(1)}
                        <span className="text-xs text-muted-foreground">({s.total_reviews})</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof Store; accent?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={accent ? "w-4 h-4 text-gold" : "w-4 h-4 text-muted-foreground"} />
      </div>
      <div className="font-display text-3xl">{value}</div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children, className }: { title: string; icon: typeof Store; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${className ?? ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-gold" />
        <h2 className="font-medium">{title}</h2>
      </div>
      {children}
    </div>
  );
}
