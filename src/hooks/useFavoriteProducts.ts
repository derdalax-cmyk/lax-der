import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProductCardData } from "@/components/ProductCard";

export function useFavoriteProducts(userId: string | undefined, favoriteIds: Set<string>) {
  const ids = Array.from(favoriteIds);
  const query = useQuery({
    queryKey: ["favorite-products", userId, ids],
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      if (!ids.length) return [];
      const { data, error } = await supabase.from("public_products")
        .select("id,title,base_price,original_price,images,is_unique,status,category").in("id", ids);
      if (error) throw error;
      const byId = new Map((data ?? []).map(p => [p.id, p as ProductCardData]));
      return ids.flatMap(id => { const product = byId.get(id); return product ? [product] : []; });
    },
  });
  return { products: query.data ?? [], loading: query.isPending };
}