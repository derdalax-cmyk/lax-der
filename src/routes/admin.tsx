import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Store, ShieldAlert, Package, UserCircle, Menu, Users, UsersRound, ShieldCheck, BarChart3, FolderTree, Flame, MessagesSquare, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · DERDALAX" }, { name: "description", content: "Painel administrativo." }] }),
  component: AdminLayout,
});

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/utilizadores", label: "Utilizadores", icon: Users },
  { to: "/admin/administradores", label: "Administradores", icon: ShieldCheck },
  { to: "/admin/vendedores", label: "Vendedores", icon: Store },
  { to: "/admin/vendedores/dashboard", label: "Dashboard de Vendedores", icon: BarChart3 },
  { to: "/admin/equipe", label: "Equipe", icon: UsersRound },
  { to: "/admin/categorias", label: "Categorias", icon: FolderTree },
  { to: "/admin/categorias-destaque", label: "Categorias em Destaque", icon: Flame },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/roleta", label: "Roleta de Descontos", icon: Gift },
  { to: "/admin/denuncias", label: "Denúncias", icon: ShieldAlert },
  { to: "/admin/conversas", label: "Conversas", icon: MessagesSquare },
  { to: "/perfil", label: "Perfil", icon: UserCircle },
];

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button aria-label="Abrir menu" className="p-2 -ml-2 rounded-md hover:bg-secondary">
                <Menu className="w-6 h-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[74vw] max-w-sm p-0 flex flex-col">
              <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
                <SheetTitle className="font-display text-lg tracking-[0.2em] text-gold text-left">DERDALAX</SheetTitle>
                <p className="text-xs text-muted-foreground text-left">Painel administrativo</p>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto py-1">
                {nav.map((n, idx) => {
                  const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.to}
                      to={n.to as "/admin"}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-5 py-2 text-sm transition-colors",
                        idx > 0 && "border-t border-border/60",
                        active ? "bg-gold/10 text-gold font-semibold" : "text-foreground hover:bg-secondary",
                      )}
                    >
                      <span className={cn("w-8 h-8 rounded-lg grid place-items-center shrink-0", active ? "bg-gold/20 text-gold" : "bg-secondary text-muted-foreground")}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1">{n.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <Link to="/admin" className="font-display text-lg tracking-[0.2em] text-gold">DERDALAX</Link>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>
      </header>
      <section className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6 min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
