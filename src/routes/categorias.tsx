import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCity } from "@/contexts/CityContext";
import { CategoryIcon } from "@/lib/categoryIcons";
import { useCategories } from "@/hooks/useCategories";
import { useProductFeed } from "@/hooks/useProductFeed";
import { useFavorites } from "@/hooks/useFavorites";
import { ProductCard } from "@/components/ProductCard";
import { ProductMasonry } from "@/components/product/ProductMasonry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const searchSchema = z.object({
  categoria: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  min: fallback(z.string(), "").default(""),
  max: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/categorias")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [
    { title: "Categorias · Derdalax" },
    { name: "description", content: "Explore as categorias da loja Derdalax: camisas, calças, sapatos e mais." },
    { property: "og:title", content: "Categorias · Derdalax" },
    { property: "og:description", content: "Explore as categorias da loja Derdalax: camisas, calças, sapatos e mais." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: CategoriasPage,
});

function CategoriasPage() {
  const { city } = useCity();

  const { categories } = useCategories();
  const { categoria, q, min, max } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { isFavorite, toggle } = useFavorites();
  const { items, loading, loadingMore, error, retry, sentinelRef } = useProductFeed({
    category: categoria || "all", search: q, minPrice: min, maxPrice: max, city,
  });
  const selectCategory = (slug: string) => void navigate({
    search: previous => ({ ...previous, categoria: slug }),
    replace: true, resetScroll: false,
  });
  const selectedLabel = categories.find(c => c.slug === categoria)?.label ?? "Todos";

  // Single server-side aggregate: a category only appears publicly when it has
  // at least one approved, unsold product. Admin surfaces keep seeing all.
  const { data: counts = {} } = useQuery({
    queryKey: ["category-product-counts"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_explore_facets");
      if (error) throw error;
      return ((data as { categories?: Record<string, number> } | null)?.categories ?? {}) as Record<string, number>;
    },
  });
  const visibleCategories = categories.filter(c => (counts[c.slug] ?? 0) > 0);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-5 py-6 md:py-12">
      <header className="mb-6 md:mb-8">
        <h1 className="font-display text-3xl md:text-5xl">Categorias</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">Encontre a peça certa por categoria.</p>
      </header>

      <div className="grid grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[144px_minmax(0,1fr)] md:grid-cols-[200px_minmax(0,1fr)] gap-3 md:gap-6 items-start">
        <nav aria-label="Categorias de produtos" className="sticky top-20 max-h-[calc(100dvh-180px)] overflow-y-auto overscroll-contain border-r border-border pr-2 space-y-1">
          <Button variant="ghost" aria-pressed={!categoria || categoria === "all"} onClick={() => selectCategory("")} className={cn("w-full justify-start", (!categoria || categoria === "all") && "bg-gold/10 text-gold")}>Todos</Button>
          {visibleCategories.map(c => (
            <Button key={c.slug} variant="ghost" aria-pressed={categoria === c.slug} onClick={() => selectCategory(c.slug)} className={cn("w-full h-auto min-h-10 px-2 py-2 justify-start whitespace-normal text-left text-xs sm:text-sm", categoria === c.slug && "bg-gold/10 text-gold")}>
              <CategoryIcon icon={c.icon} className="hidden sm:block shrink-0" />
              <span className="min-w-0 break-words">{c.label}</span>
            </Button>
          ))}
        </nav>
        <div className="min-w-0">
          <h2 className="font-display text-lg md:text-2xl mb-3">{selectedLabel}</h2>
          {loading ? (
            <div role="status" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[3/4] bg-secondary animate-pulse rounded-lg" />)}
              <span className="sr-only">A carregar produtos</span>
            </div>
          ) : items.length > 0 ? (
            <ProductMasonry className="grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {items.map(product => <ProductCard key={product.id} product={product} isFavorite={isFavorite(product.id)} onToggleFavorite={toggle} />)}
            </ProductMasonry>
          ) : !error && <p className="py-12 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
          <div ref={sentinelRef} className="h-px" />
          {loadingMore && <Loader2 aria-label="A carregar produtos" className="w-5 h-5 mx-auto mt-4 animate-spin text-muted-foreground" />}
          {error && <div role="alert" className="py-6 text-center text-sm"><p>Não foi possível carregar os produtos.</p><Button variant="ghost" onClick={retry}>Tentar novamente</Button></div>}
        </div>
      </div>
    </div>
  );
}
