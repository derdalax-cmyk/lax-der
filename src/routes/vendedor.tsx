import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeller } from "@/hooks/useSeller";
import { LayoutDashboard, Package, Store, Clock, Loader2, ChevronRight, ShoppingBag, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SellerNotificationBell } from "@/components/vendedor/SellerNotificationBell";

export const Route = createFileRoute("/vendedor")({
  head: () => ({ meta: [{ title: "Painel do Vendedor · DERDALAX" }, { name: "description", content: "Gerir a sua loja na DERDALAX." }] }),
  component: SellerLayout,
});

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/vendedor", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/vendedor/produtos", label: "Produtos", icon: Package },
  { to: "/vendedor/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/vendedor/destaques", label: "Destaques", icon: Sparkles },
  { to: "/vendedor/loja", label: "Minha loja", icon: Store },
];

function SellerLayout() {
  const { user, loading: authLoading } = useAuth();
  const { seller, isApproved, loading } = useSeller();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No seller record or not approved yet → show status card
  if (!seller || !isApproved) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gold/15 text-gold grid place-items-center mx-auto mb-5">
          {seller ? <Clock className="w-8 h-8" /> : <Store className="w-8 h-8" />}
        </div>
        <h1 className="font-display text-2xl mb-2">
          {!seller ? "Ainda não é vendedor" : seller.status === "rejected" ? "Candidatura não aprovada" : "Candidatura em análise"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {!seller
            ? "Torne-se vendedor para começar a vender os seus produtos na DERDALAX."
            : seller.status === "rejected"
              ? "A sua candidatura não foi aprovada. Contacte o suporte para mais informações."
              : "A sua candidatura está a ser analisada pela nossa equipa. Assim que for aprovada, poderá gerir a sua loja aqui."}
        </p>
        <Button asChild className="bg-ink text-gold hover:bg-ink/90">
          <Link to={!seller ? "/tornar-se-vendedor" : "/"}>
            {!seller ? "Tornar-se vendedor" : "Voltar à loja"} <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 md:grid-cols-[230px_1fr] gap-6">
      <aside className="md:sticky md:top-20 md:self-start bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-2.5 px-2 py-3 mb-1 border-b border-border">
          <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden grid place-items-center shrink-0">
            {seller.logo_url ? <img src={seller.logo_url} alt={seller.store_name} className="w-full h-full object-cover" /> : <Store className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{seller.store_name}</p>
            <p className="text-[11px] text-success">Loja ativa</p>
          </div>
        </div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto pt-2">
          {nav.map((n) => {
            const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to as "/vendedor"}
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
        <div className="flex items-center justify-end mb-3">
          <SellerNotificationBell />
        </div>
        <Outlet />
      </section>
    </div>
  );
}
