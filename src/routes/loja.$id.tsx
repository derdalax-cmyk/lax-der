import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { StarRating } from "@/components/StarRating";
import { SellerReviews } from "@/components/SellerReviews";
import { useFavorites } from "@/hooks/useFavorites";
import { ContactSellerButton } from "@/components/ContactSellerButton";
import { Store, MapPin, Loader2, Package } from "lucide-react";

export const Route = createFileRoute("/loja/$id")({
  head: () => ({ meta: [{ title: "Loja · DERDALAX" }, { name: "description", content: "Perfil da loja e avaliações na DERDALAX." }, { property: "og:title", content: "Loja · DERDALAX" }, { property: "og:description", content: "Perfil da loja e avaliações na DERDALAX." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: LojaPublica,
});

type PublicSeller = {
  id: string;
  store_name: string;
  logo_url: string | null;
  city: string | null;
  province: string | null;
  description: string | null;
  rating: number | null;
  total_reviews: number | null;
  created_at: string;
  product_count: number;
};

function LojaPublica() {
  const { id } = Route.useParams();
  const { isFavorite, toggle } = useFavorites();

  const { data: seller, isLoading } = useQuery({
    queryKey: ["public-seller", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_seller", { _id: id });
      if (error) throw error;
      return (data ?? null) as unknown as PublicSeller | null;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["public-seller-products", id],
    enabled: !!seller?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_products")
        .select("id,title,base_price,original_price,images,is_unique,status,category")
        .eq("seller_id", id)
        .eq("approval_status", "approved")
        .neq("status", "sold")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductCardData[];
    },
  });

  if (isLoading) {
    return <div className="min-h-[50vh] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!seller) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-20 text-center">
        <h1 className="font-display text-3xl mb-3">Loja não encontrada</h1>
        <Link to="/explorar" className="text-gold underline">Explorar produtos</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8 md:py-12">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-8">
        <div className="w-24 h-24 rounded-2xl bg-secondary overflow-hidden grid place-items-center shrink-0">
          {seller.logo_url ? (
            <img src={seller.logo_url} alt={seller.store_name} className="w-full h-full object-cover" />
          ) : (
            <Store className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="font-display text-2xl md:text-3xl">{seller.store_name}</h1>
          <div className="flex items-center justify-center sm:justify-start gap-3 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <StarRating value={Number(seller.rating ?? 0)} size={16} />
              <span className="text-sm font-medium">{Number(seller.rating ?? 0).toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">({seller.total_reviews ?? 0})</span>
            </span>
            {(seller.city || seller.province) && (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" /> {[seller.city, seller.province].filter(Boolean).join(", ")}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Package className="w-4 h-4" /> {seller.product_count} produto(s)
            </span>
          </div>
          {seller.description && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{seller.description}</p>
          )}
          <ContactSellerButton sellerId={seller.id} className="mt-4" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        {/* Products */}
        <section>
          <h2 className="font-display text-xl mb-4">Produtos da loja</h2>
          {products.length === 0 ? (
            <div className="bg-card border border-border rounded-xl px-4 py-12 text-center text-muted-foreground text-sm">
              Esta loja ainda não tem produtos disponíveis.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} isFavorite={isFavorite(p.id)} onToggleFavorite={toggle} />
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section>
          <h2 className="font-display text-xl mb-4">Avaliações</h2>
          <SellerReviews sellerId={seller.id} />
        </section>
      </div>
    </div>
  );
}
