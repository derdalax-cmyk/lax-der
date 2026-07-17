import { Link } from "@tanstack/react-router";
import { Home, Compass, Store, LayoutGrid, Headset } from "lucide-react";
import { useSeller } from "@/hooks/useSeller";

export function BottomNav() {
  const { isApproved } = useSeller();
  const items = [
    { to: "/" as const, label: "Início", icon: Home, exact: true },
    { to: "/explorar" as const, label: "Explorar", icon: Compass },
    { to: isApproved ? "/vendedor" as const : "/tornar-se-vendedor" as const, label: "Vender", icon: Store },
    { to: "/categorias" as const, label: "Categorias", icon: LayoutGrid },
    { to: "/suporte" as const, label: "Suporte", icon: Headset },
  ];
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-ink/95 backdrop-blur border-t border-white/10"
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
              activeOptions={{ exact: it.exact ?? false }}
              className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-white/60 transition-colors hover:text-gold"
              activeProps={{ className: "text-gold" }}
            >
              <Icon className="w-5 h-5" />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
