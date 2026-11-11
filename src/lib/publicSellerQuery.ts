import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PublicSeller } from "./sellerRatings";

export const publicSellerQuery = (id: string | null | undefined) => queryOptions({
  queryKey: ["public-seller", id],
  enabled: !!id,
  staleTime: 0,
  queryFn: async (): Promise<PublicSeller | null> => {
    if (!id) return null;
    const { data, error } = await supabase.rpc("get_public_seller", { _id: id });
    if (error) throw error;
    return (data ?? null) as unknown as PublicSeller | null;
  },
});