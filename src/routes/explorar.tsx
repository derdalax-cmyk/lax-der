import { NaturalProductImage } from "@/components/product/NaturalProductImage";
import { ProductMasonry } from "@/components/product/ProductMasonry";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useProductFeed } from "@/hooks/useProductFeed";
import { formatMZN } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useCity } from "@/contexts/CityContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { CategoryIcon } from "@/lib/categoryIcons";
import { Search, Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { thumbUrl } from "@/lib/imageUrl";
import { getProductDiscount } from "@/lib/productPrice";

export const Route = createFileRoute("/explorar")({
  validateSearch: zodValidator(z.object({ q: fallback(z.string(), "").default(""), categoria: fallback(z.string(), "all").default("all"), genero: fallback(z.string(), "all").default("all") })),
  head: () => ({ meta: [
    { title: "Explorar · DERDALAX" },
    { name: "description", content: "Explore todas as peças DERDALAX num mural de descobertas." },
    { property: "og:title", content: "Explorar · DERDALAX" },
    { property: "og:description", content: "Explore todas as peças DERDALAX num mural de descobertas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: ExplorarPage,
});

function firstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) return String((first as { url: unknown }).url);
  }
  return null;
}

function ExplorarPage() {
  const { isFavorite, toggle } = useFavorites();
  const { categories: cats } = useCategories();
  const { city } = useCity();
  const { q: search, categoria: category, genero: gender } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const update = (patch: { q?: string; categoria?: string; genero?: string }) => void navigate({ search: prev => ({ ...prev, ...patch }), replace: true, resetScroll: false });
  const setSearch = (q: string) => update({ q });
  const setCategory = (categoria: string) => update({ categoria });
  const setGender = (genero: string) => update({ genero });
  const searchDebounced = search;

  const hasActiveFilters = !!searchDebounced.trim() || category !== "all" || gender !== "all";



  const { items, loading, loadingMore, error, retry, sentinelRef } = useProductFeed({ search: searchDebounced, category, gender, city });

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-8 md:py-12">
      <header className="mb-6">
        <h1 className="font-display text-4xl md:text-5xl">Explorar</h1>
        <p className="text-muted-foreground mt-2">Um mural de peças para descobrir.</p>
      </header>

      <div className="flex flex-col gap-3 mb-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar peças…" className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-auto min-w-[9rem]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {cats.map((c) => <SelectItem key={c.slug} value={c.slug}><CategoryIcon icon={c.icon} className="w-4 h-4 mr-1 inline" /> {c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger aria-label="Filtrar por sexo" className="w-auto min-w-[7.5rem]"><SelectValue /></SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">Ver todos</SelectItem>
              <SelectItem value="unissex">Unissex</SelectItem>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>



      {loading && items.length === 0 ? (
        <ProductMasonry className="mx-auto grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-start gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="mb-4 bg-secondary animate-pulse rounded-xl" style={{ height: 180 + (i % 4) * 60 }} />
          ))}
        </ProductMasonry>
      ) : items.length === 0 ? (
        hasActiveFilters ? (
          <div className="text-center py-20 text-muted-foreground">
            {searchDebounced.trim()
              ? `Nenhuma peça encontrada para "${searchDebounced.trim()}".`
              : "Nenhuma peça encontrada com esses filtros."}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">Nenhuma peça encontrada.</div>
        )

      ) : (
        <>
          <ProductMasonry className="mx-auto grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-start gap-3 sm:gap-4">
            {items.map((p) => {
              const img = firstImage(p.images);
              const fav = isFavorite(p.id);
              const discount = getProductDiscount(Number(p.base_price), p.original_price);
              return (
                <div key={p.id} data-product-id={p.id} className="min-w-0 group relative">
                  <Link to="/produto/$id" params={{ id: p.id }} state={{ productOrigin: true }} className="block rounded-xl overflow-hidden border border-border bg-card">
                    <NaturalProductImage src={img ? thumbUrl(img) : null} alt={p.title}>
                      {p.is_unique && (
                        <span className="absolute top-2 left-2 bg-gold text-ink text-[10px] tracking-wider px-2 py-1 rounded font-semibold">PEÇA ÚNICA</span>
                      )}
                    </NaturalProductImage>
                    <div className="p-3">
                      <h3 className="min-h-10 font-medium text-sm line-clamp-2 break-words">{p.title}</h3>
                      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm">
                        <span data-product-price className="text-gold font-semibold break-words">{formatMZN(Number(p.base_price))}</span>
                        {discount && <span className="text-xs text-muted-foreground line-through">{formatMZN(discount.originalPrice)}</span>}
                        {discount && <span className="text-xs font-medium text-destructive">-{discount.discountPercent}%</span>}
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    aria-label="Favoritar"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(p.id); }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background border border-border"
                  >
                    <Heart className={cn("w-4 h-4", fav ? "fill-destructive text-destructive" : "text-foreground")} />
                  </button>
                </div>
              );
            })}
          </ProductMasonry>

        </>
      )}
      <div ref={sentinelRef} className="h-px" />
      {loadingMore && <Loader2 aria-label="A carregar produtos" className="w-5 h-5 mx-auto mt-6 animate-spin text-muted-foreground" />}
      {error && <div role="alert" className="text-center mt-6"><p>Não foi possível carregar os produtos.</p><Button variant="ghost" onClick={retry}>Tentar novamente</Button></div>}
    </div>
  );
}
