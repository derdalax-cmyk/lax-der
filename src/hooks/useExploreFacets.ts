import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ExploreFacets = { sizes: string[]; colors: string[]; sellers: { id: string; name: string }[]; price_max: number; suggestions: string[] };
const EMPTY: ExploreFacets = { sizes: [], colors: [], sellers: [], price_max: 0, suggestions: [] };

/** Distinct, bounded filter values computed server-side from public products; cached for the session. */
export function useExploreFacets() {
  const q = useQuery({
    queryKey: ["explore-facets"],
    staleTime: 10 * 60_000,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_explore_facets");
      if (error) throw error;
      return { ...EMPTY, ...(data as Partial<ExploreFacets>) };
    },
  });
  return q.data ?? EMPTY;
}

/** Exact filtered count (capped server-side at 10 000). */
export function useExploreCount(args: Record<string, unknown>, enabled: boolean) {
  return useQuery({
    queryKey: ["explore-count", args],
    enabled,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("explore_products_count", args as never).abortSignal(signal);
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}
