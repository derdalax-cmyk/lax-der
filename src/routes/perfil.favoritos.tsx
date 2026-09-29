import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/useFavorites";

export const Route = createFileRoute("/perfil/favoritos")({
  head: () => ({ meta: [{ title: "Favoritos · DERDALAX" }] }),
  component: FavoritosPage,
});

function FavoritosPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { favoriteIds, isFavorite, toggle } = useFavorites();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/login" }); }, [user, authLoading, navigate]);

  useEffect(() => {
    const load = async () => {
      const ids = Array.from(favoriteIds);
      if (ids.length === 0) { setProducts([]); setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select("id,title,base_price,original_price,images,is_unique,status,category")
        .in("id", ids);
      setProducts((data ?? []) as ProductCardData[]);
      setLoading(false);
    };
    if (user) load();
  }, [favoriteIds, user]);

  if (!user) return null;

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-10 md:py-14">
      <h1 className="font-display text-4xl mb-8">Os meus favoritos</h1>
      {loading ? (
        <div className="text-muted-foreground">A carregar…</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Ainda não tem favoritos.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} isFavorite={isFavorite(p.id)} onToggleFavorite={toggle} />
          ))}
        </div>
      )}
    </div>
  );
}
