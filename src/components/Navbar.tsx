import { Link } from "@tanstack/react-router";
import { Heart, ShoppingCart, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { CitySelector } from "@/components/CitySelector";
import { useSeller } from "@/hooks/useSeller";

export function Navbar() {
  const { user } = useAuth();
  const { count } = useCart();
  const { isApproved } = useSeller();
  const links = [
    { to: "/" as const, label: "Início" },
    { to: "/explorar" as const, label: "Explorar" },
    { to: isApproved ? "/vendedor" as const : "/tornar-se-vendedor" as const, label: "Vender" },
    { to: "/categorias" as const, label: "Categorias" },
    { to: "/suporte" as const, label: "Suporte" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-ink text-white border-b border-white/5">
      <div className="max-w-[1400px] mx-auto px-5">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-display text-2xl font-bold tracking-wider text-gold">
              DERDALAX
            </Link>
            <CitySelector className="hidden sm:inline-flex" />
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                className="text-sm font-medium text-white/80 hover:text-gold transition-colors"
                activeProps={{ className: "text-gold" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <CitySelector compact className="sm:hidden" />
            <Link to={user ? "/favoritos" : "/login"} className="hover:text-gold transition-colors" aria-label="Favoritos">
              <Heart className="w-5 h-5" />
            </Link>
            <Link to="/carrinho" className="relative hover:text-gold transition-colors" aria-label="Carrinho">
              <ShoppingCart className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-gold text-ink text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{count}</span>
              )}
            </Link>
            <Link to={user ? "/perfil" : "/login"} className="hover:text-gold transition-colors" aria-label="Conta">
              <User className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
