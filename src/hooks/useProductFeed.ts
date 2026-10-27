import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProductCardData } from "@/components/ProductCard";
import { PRODUCT_BATCH_SIZE, productFeedCondition, uniqueProducts, type ProductCursor } from "@/lib/productFeed";

type Filters = { search: string; category: string; city: string | null | undefined; gender?: string; minPrice?: string; maxPrice?: string };
type Row = ProductCardData & ProductCursor;

export function useProductFeed(filters: Filters) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const query = useInfiniteQuery({
    queryKey: ["product-feed", filters],
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    initialPageParam: null as ProductCursor | null,
    retry: false,
    queryFn: async ({ pageParam, signal }) => {
      let q = supabase.from("public_products")
        .select("id,title,base_price,original_price,images,is_unique,status,category,created_at")
        .neq("status", "sold")
        .order("created_at", { ascending: false }).order("id", { ascending: false });
      if (filters.search.trim()) q = q.ilike("title", `%${filters.search.trim()}%`);
      if (filters.category !== "all") q = q.eq("category", filters.category);
      if (filters.gender && filters.gender !== "all") q = q.ilike("description", `%"gender":"${filters.gender}"%`);
      if (filters.minPrice && Number.isFinite(Number(filters.minPrice))) q = q.gte("base_price", Number(filters.minPrice));
      if (filters.maxPrice && Number.isFinite(Number(filters.maxPrice))) q = q.lte("base_price", Number(filters.maxPrice));
      const condition = productFeedCondition(filters.city, pageParam);
      if (condition) q = q.or(condition);
      const { data, error } = await q.limit(PRODUCT_BATCH_SIZE).abortSignal(signal);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    getNextPageParam: (last) => {
      const tail = last.at(-1);
      return last.length === PRODUCT_BATCH_SIZE && tail ? { created_at: tail.created_at, id: tail.id } : undefined;
    },
  });
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasNextPage || isFetching || isError) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void fetchNextPage();
    }, { rootMargin: "700px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, isError, fetchNextPage]);
  return { items: uniqueProducts(query.data?.pages ?? []), loading: query.isPending, loadingMore: query.isFetchingNextPage, error: query.isError, retry: () => query.refetch(), sentinelRef };
}