import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, Store, LayoutGrid, Headset } from "lucide-react";
import { useSeller } from "@/hooks/useSeller";
import { mobileNavSection } from "@/lib/homePresentation";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { isApproved } = useSeller();
  const active = useRouterState({ select: s => mobileNavSection(s.location.pathname) });
  const items = [
    { section: "home", to: "/" as const, label: "Início", icon: Home },
    { section: "explore", to: "/explorar" as const, label: "Explorar", icon: Compass },
    { section: "sell", to: isApproved ? "/vendedor" as const : "/tornar-se-vendedor" as const, label: "Vender", icon: Store },
    { section: "categories", to: "/categorias" as const, label: "Categorias", icon: LayoutGrid },
    { section: "support", to: "/suporte" as const, label: "Suporte", icon: Headset },
  ];
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-ink/95 backdrop-blur border-t border-primary-foreground/10"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      <div className="grid grid-cols-5">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-current={active === it.section ? "page" : undefined}
              activeProps={{ "aria-current": active === it.section ? "page" : undefined }}
              className={cn("relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-200 motion-reduce:transition-none hover:text-gold", active === it.section ? "text-gold" : "text-primary-foreground/60")}
            >
              <Icon className="w-5 h-5" />
              {it.label}
              <span aria-hidden="true" className={cn("absolute bottom-1 h-0.5 w-4 rounded-full bg-gold transition-opacity duration-200 motion-reduce:transition-none", active === it.section ? "opacity-100" : "opacity-0")} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
