import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Users, Store } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase text-muted-foreground tracking-wider">{label}</div>
        <div className="font-display text-3xl mt-1">{value}</div>
      </div>
      <Icon className="w-8 h-8 text-gold" />
    </div>
  );
}

function AdminHome() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [p, s, u] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("sellers").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      return { products: p.count ?? 0, sellers: s.count ?? 0, users: u.count ?? 0 };
    },
  });

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Bem-vindo ao painel</h1>
      <p className="text-muted-foreground mb-6">Resumo da loja DERDALAX.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Produtos" value={data?.products ?? "—"} icon={Package} />
        <StatCard label="Vendedores" value={data?.sellers ?? "—"} icon={Store} />
        <StatCard label="Utilizadores" value={data?.users ?? "—"} icon={Users} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/admin/produtos" className="bg-ink text-white rounded-xl p-6 hover:bg-ink/90 transition">
          <Package className="w-6 h-6 text-gold mb-2" />
          <div className="font-display text-xl">Gerir produtos</div>
          <p className="text-sm text-white/70 mt-1">Criar, editar e remover produtos e variações.</p>
        </Link>
        <Link to="/admin/administradores" className="bg-gold text-ink rounded-xl p-6 hover:bg-gold/90 transition">
          <Users className="w-6 h-6 mb-2" />
          <div className="font-display text-xl">Administradores</div>
          <p className="text-sm text-ink/80 mt-1">Conceder acesso ao painel a outros emails.</p>
        </Link>
      </div>
    </div>
  );
}
