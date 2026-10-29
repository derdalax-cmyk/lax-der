import { useEffect, useRef, useSyncExternalStore } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { isListRestoring, listContextKey, registerListLoader, subscribeListRestoration } from "@/lib/listContext";
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
  const loc = useRouterState({ select: (st) => listContextKey(st.location.pathname, st.location.searchStr ?? "") });
  const restoring = useSyncExternalStore(subscribeListRestoration, () => isListRestoring(loc), () => false);
  const live = useRef(query);
  live.current = query;
  useEffect(() => registerListLoader(loc, {
    loadMore: () => live.current.hasNextPage && !live.current.isFetching ? live.current.fetchNextPage() : undefined,
    hasMore: () => !!live.current.hasNextPage,
    batches: () => live.current.data?.pages.length ?? 0,
  }), [loc]);
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasNextPage || isFetching || isError || restoring) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (isListRestoring(loc)) return;
      const grids = document.querySelectorAll<HTMLElement>("[data-product-masonry]");
      if (Array.from(grids).some(grid => grid.dataset.layoutReady === "false")) return;
      if (entry?.isIntersecting) void fetchNextPage();
    }, { rootMargin: "700px" });
    observer.observe(target);
    const mutation = new MutationObserver(() => {
      observer.unobserve(target); observer.observe(target);
    });
    for (const grid of document.querySelectorAll("[data-product-masonry]")) mutation.observe(grid, { attributes: true, attributeFilter: ["data-layout-ready"] });
    return () => { observer.disconnect(); mutation.disconnect(); };
  }, [hasNextPage, isFetching, isError, fetchNextPage, restoring, loc]);
  return { items: uniqueProducts(query.data?.pages ?? []), loading: query.isPending, loadingMore: query.isFetchingNextPage, error: query.isError, retry: () => query.refetch(), sentinelRef };
}