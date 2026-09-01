import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicCategory = {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
  sort_order: number;
};

/**
 * Single source of truth for the store categories (admin-managed table).
 * Shared query key so every surface (home, explorar, categorias, filtros,
 * formulários de produto) reflects creations/removals immediately.
 */
export function useCategories() {
  const query = useQuery({
    queryKey: ["public-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,slug,label,icon,sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as PublicCategory[];
    },
    staleTime: 60_000,
  });

  const categories = query.data ?? [];
  return {
    categories,
    isPending: query.isPending,
    labelOf: (slug: string | null | undefined) =>
      slug ? (categories.find((c) => c.slug === slug)?.label ?? slug) : "—",
  };
}
