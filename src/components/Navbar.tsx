import { Link } from "@tanstack/react-router";
import { Search, Heart, ShoppingCart, User, Menu } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { cn } from "@/lib/utils";


const links: { to: "/" | "/explorar" | "/categorias" | "/suporte"; label: string }[] = [
  { to: "/", label: "Início" },
  { to: "/explorar", label: "Explorar" },
  { to: "/categorias", label: "Categorias" },
  { to: "/suporte", label: "Suporte" },
];

export function Navbar() {
  const { user, isAdmin } = useAuth();
  const { count } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);


  return (
    <header className="sticky top-0 z-50 bg-ink text-white border-b border-white/5">
      <div className="max-w-[1400px] mx-auto px-5">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="font-display text-2xl font-bold tracking-wider text-gold">
            DERDALAX
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-sm font-medium text-white/80 hover:text-gold transition-colors"
                activeProps={{ className: "text-gold" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button className="hidden sm:block hover:text-gold transition-colors" aria-label="Pesquisar">
              <Search className="w-5 h-5" />
            </button>
            <Link to={user ? "/perfil" : "/login"} className="hover:text-gold transition-colors hidden sm:block" aria-label="Favoritos">
              <Heart className="w-5 h-5" />
            </Link>
            <Link to="/carrinho" className="relative hover:text-gold transition-colors" aria-label="Carrinho">
              <ShoppingCart className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-gold text-ink text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{count}</span>
              )}
            </Link>

            <Link to={user ? (isAdmin ? "/admin" : "/perfil") : "/login"} className="hover:text-gold transition-colors" aria-label="Conta">
              <User className="w-5 h-5" />
            </Link>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden hover:text-gold" aria-label="Menu">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden pb-4 flex flex-col gap-2 border-t border-white/10 pt-3">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className={cn("py-2 text-sm font-medium text-white/80 hover:text-gold")}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
