import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeller } from "@/hooks/useSeller";
import { LayoutDashboard, Package, Store, Clock, Loader2, ChevronRight, ShoppingBag, CalendarClock, MessageSquare, Menu, Flame, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SellerNotificationBell } from "@/components/vendedor/SellerNotificationBell";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/vendedor")({
  head: () => ({ meta: [{ title: "Painel do Vendedor · Derdalax" }, { name: "description", content: "Gerir a sua loja na Derdalax." }] }),
  component: SellerLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; soon?: boolean; hidden?: boolean };
const nav: NavItem[] = [
  { to: "/vendedor", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/vendedor/produtos", label: "Produtos", icon: Package },
  { to: "/vendedor/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/vendedor/destaques", label: "Destaques", icon: Flame },
  { to: "/vendedor/equipe", label: "Equipe", icon: Users },
  { to: "/vendedor/mensalidade", label: "Mensalidade", icon: CalendarClock, soon: true, hidden: true },
  { to: "/vendedor/mensagens", label: "Mensagens", icon: MessageSquare },
  { to: "/vendedor/loja", label: "Minha loja", icon: Store },
];

function SellerLayout() {
  const { user, loading: authLoading } = useAuth();
  const { seller, isApproved, loading } = useSeller();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

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
            ? "Torne-se vendedor para começar a vender os seus produtos na Derdalax."
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
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button aria-label="Abrir menu" className="p-2 -ml-2 rounded-md hover:bg-secondary">
                <Menu className="w-6 h-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[74vw] max-w-sm p-0 flex flex-col">
              <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-secondary overflow-hidden grid place-items-center shrink-0">
                    {seller.logo_url ? <img src={seller.logo_url} alt={seller.store_name} className="w-full h-full object-cover" /> : <Store className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 text-left">
                    <SheetTitle className="text-sm font-semibold truncate">{seller.store_name}</SheetTitle>
                    <p className="text-[11px] text-success">Loja ativa</p>
                  </div>
                </div>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto py-1">
                {nav.filter((n) => !n.hidden).map((n, idx) => {
                  const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.to}
                      to={n.to as "/vendedor"}
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
                      {n.soon && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-gold bg-gold/10 border border-gold/30 rounded-full px-2 py-0.5">
                          em breve
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <Link to="/vendedor" className="font-display text-lg tracking-[0.2em] text-gold">Derdalax</Link>
          <div className="ml-auto">
            <SellerNotificationBell />
          </div>
        </div>
      </header>
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
