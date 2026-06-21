import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Package, Users, ShoppingBag, Shield, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · DERDALAX" }, { name: "description", content: "Painel administrativo." }] }),
  component: AdminLayout,
});

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/categorias-destaque", label: "Destaques", icon: Star },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/admin/administradores", label: "Administradores", icon: Shield },
  { to: "/admin/utilizadores", label: "Utilizadores", icon: Users },
];

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);

  if (loading || !isAdmin) return null;

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
      <aside className="md:sticky md:top-20 md:self-start bg-card border border-border rounded-xl p-3">
        <div className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Painel</div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {nav.map((n) => {
            const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to as "/admin"}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors",
                  active ? "bg-ink text-gold" : "text-foreground hover:bg-secondary",
                )}
              >
                <Icon className="w-4 h-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
