import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/useFavorites";
import { Heart, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/favoritos")({
  head: () => ({
    meta: [
      { title: "Favoritos · DERDALAX" },
      { name: "description", content: "As suas peças favoritas guardadas na DERDALAX." },
      { property: "og:title", content: "Favoritos · DERDALAX" },
      { property: "og:description", content: "As suas peças favoritas guardadas na DERDALAX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavoritosPage,
});

function FavoritosPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { favoriteIds, isFavorite, toggle } = useFavorites();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const load = async () => {
      const ids = Array.from(favoriteIds);
      if (ids.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("public_products")
        .select("id,title,base_price,original_price,images,is_unique,status,category")
        .in("id", ids);
      // keep only currently-favorited and preserve order of favoriting
      const byId = new Map((data ?? []).map((p) => [p.id, p as ProductCardData]));
      setProducts(ids.map((id) => byId.get(id)).filter(Boolean) as ProductCardData[]);
      setLoading(false);
    };
    if (user) load();
  }, [favoriteIds, user]);

  if (!user) return null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-5 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <span className="h-11 w-11 rounded-2xl bg-[#c44545]/10 flex items-center justify-center shrink-0">
          <Heart className="w-5 h-5 text-[#c44545] fill-[#c44545]" />
        </span>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">Os meus favoritos</h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "A carregar…"
              : products.length === 0
                ? "Nenhuma peça guardada ainda"
                : `${products.length} ${products.length === 1 ? "peça guardada" : "peças guardadas"}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <div className="aspect-[3/4] bg-secondary animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 bg-secondary rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-secondary rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 sm:py-24">
          <span className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-5">
            <Heart className="w-9 h-9 text-muted-foreground" />
          </span>
          <h2 className="font-display text-xl font-semibold">A sua lista está vazia</h2>
          <p className="text-muted-foreground mt-1 max-w-sm">
            Toque no coração das peças que mais gosta para as guardar aqui e voltar mais tarde.
          </p>
          <Button asChild className="mt-6 bg-gold text-ink hover:bg-gold/90">
            <Link to="/explorar">
              <ShoppingBag className="w-4 h-4 mr-1.5" /> Explorar peças
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isFavorite={isFavorite(p.id)}
              onToggleFavorite={toggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
