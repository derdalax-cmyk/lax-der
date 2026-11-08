import { ProductMasonry } from "@/components/product/ProductMasonry";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteProducts } from "@/hooks/useFavoriteProducts";
import { ProductCard } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/useFavorites";

export const Route = createFileRoute("/perfil/favoritos")({
  head: () => ({ meta: [{ title: "Favoritos do perfil · Derdalax" }, { name: "description", content: "Peças guardadas no seu perfil Derdalax." }, { property: "og:title", content: "Favoritos do perfil · Derdalax" }, { property: "og:description", content: "Peças guardadas no seu perfil Derdalax." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: FavoritosPage,
});

function FavoritosPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { favoriteIds, isFavorite, toggle } = useFavorites();
  const { products, loading } = useFavoriteProducts(user?.id, favoriteIds);

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/login" }); }, [user, authLoading, navigate]);

  if (!user) return null;

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-10 md:py-14">
      <h1 className="font-display text-4xl mb-8">Os meus favoritos</h1>
      {loading ? (
        <div className="text-muted-foreground">A carregar…</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Ainda não tem favoritos.</div>
      ) : (
        <ProductMasonry className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} isFavorite={isFavorite(p.id)} onToggleFavorite={toggle} />
          ))}
        </ProductMasonry>
      )}
    </div>
  );
}
