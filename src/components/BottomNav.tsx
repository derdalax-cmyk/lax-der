import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, Store, LayoutGrid, Headset, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeller } from "@/hooks/useSeller";
import { mobileNavSection } from "@/lib/homePresentation";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { isApproved } = useSeller();
  const { user, needsProfileCompletion } = useAuth();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const active = useRouterState({ select: s => mobileNavSection(s.location.pathname) });
  const items = [
    { section: "home", to: "/" as const, label: "Início", icon: Home },
    { section: "explore", to: "/explorar" as const, label: "Explorar", icon: Compass },
    { section: "sell", to: isApproved ? "/vendedor" as const : "/tornar-se-vendedor" as const, label: "Vender", icon: Store },
    { section: "categories", to: "/categorias" as const, label: "Categorias", icon: LayoutGrid },
    { section: "support", to: "/suporte" as const, label: "Suporte", icon: Headset },
    ...(user ? [{ section: "profile", to: "/perfil" as const, label: "Perfil", icon: User }] : []),
  ];
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-ink/95 backdrop-blur border-t border-primary-foreground/10"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      <div className={user ? "grid grid-cols-6" : "grid grid-cols-5"}>
        {items.map((it) => {
          const Icon = it.icon;
          const selected = it.section === "profile" ? pathname.startsWith("/perfil") : active === it.section;
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-current={selected ? "page" : undefined}
              activeProps={{ "aria-current": selected ? "page" : undefined }}
              className={cn("relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-200 motion-reduce:transition-none hover:text-gold", selected ? "text-gold" : "text-primary-foreground/60")}
            >
              <span className="relative"><Icon className="w-5 h-5" />{it.section === "profile" && needsProfileCompletion && <span aria-label="Perfil incompleto" className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />}</span>
              {it.label}
              <span aria-hidden="true" className={cn("absolute bottom-1 h-0.5 w-4 rounded-full bg-gold transition-opacity duration-200 motion-reduce:transition-none", selected ? "opacity-100" : "opacity-0")} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
