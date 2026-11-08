import { ProductMasonry } from "@/components/product/ProductMasonry";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo } from "react";
import { useProductFeed } from "@/hooks/useProductFeed";
import { ProductCard } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useCity } from "@/contexts/CityContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { Search, Loader2 } from "lucide-react";

const searchSchema = z.object({
  categoria: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  min: fallback(z.string(), "").default(""),
  max: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/produtos")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [
    { title: "Produtos · Derdalax" },
    { name: "description", content: "Explore a coleção Derdalax — peças únicas e selecionadas." },
    { property: "og:title", content: "Produtos · Derdalax" },
    { property: "og:description", content: "Explore a coleção Derdalax — peças únicas e selecionadas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: ProdutosPage,
});

function ProdutosPage() {
  const { categories: catList } = useCategories();
  const { categoria, q: search, min: minPrice, max: maxPrice } = Route.useSearch();
  const { isFavorite, toggle } = useFavorites();
  const { city } = useCity();
  const navigate = useNavigate({ from: Route.fullPath });
  const update = (patch: { q?: string; categoria?: string; min?: string; max?: string }) => void navigate({ search: prev => ({ ...prev, ...patch }), replace: true, resetScroll: false });
  const category = categoria || "all";
  const searchDebounced = search;
  const setSearch = (q: string) => update({ q });
  const setCategory = (categoria: string) => update({ categoria });
  const setMinPrice = (min: string) => update({ min });
  const setMaxPrice = (max: string) => update({ max });

  const { items: products, loading, loadingMore, error, retry, sentinelRef } = useProductFeed({ search: searchDebounced, category, minPrice, maxPrice, city });

  const clearFilters = () => {
    update({ q: "", categoria: "all", min: "", max: "" });
  };

  const hasFilters = useMemo(() => !!(search || category !== "all" || minPrice || maxPrice), [search, category, minPrice, maxPrice]);

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-10 md:py-14">
      <header className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl">Catálogo</h1>
        <p className="text-muted-foreground mt-2">Descubra peças cuidadosamente selecionadas.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-3 md:items-end mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome…" className="pl-9" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {catList.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="number" inputMode="numeric" placeholder="Min (MT)" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-28" />
          <Input type="number" inputMode="numeric" placeholder="Max (MT)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-28" />
        </div>
        {hasFilters && <Button variant="ghost" onClick={clearFilters}>Limpar</Button>}
      </div>

      {loading ? (
        <ProductMasonry className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-secondary animate-pulse rounded-xl" />
          ))}
        </ProductMasonry>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">Nenhum produto encontrado.</div>
      ) : (
        <>
          <ProductMasonry className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} isFavorite={isFavorite(p.id)} onToggleFavorite={toggle} />
            ))}
          </ProductMasonry>

        </>
      )}
      <div ref={sentinelRef} className="h-px" />
      {loadingMore && <Loader2 aria-label="A carregar produtos" className="w-5 h-5 mx-auto mt-6 animate-spin text-muted-foreground" />}
      {error && <div role="alert" className="text-center mt-6"><p>Não foi possível carregar os produtos.</p><Button variant="ghost" onClick={retry}>Tentar novamente</Button></div>}
    </div>
  );
}
