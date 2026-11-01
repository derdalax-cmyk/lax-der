import { ProductCardSkeleton } from "@/components/product/ProductCardSkeleton";
import { NaturalProductImage } from "@/components/product/NaturalProductImage";
import { ProductMasonry } from "@/components/product/ProductMasonry";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useMemo, useState } from "react";
import { exploreSearchSchema, countAdvanced, exploreRpcArgs, splitList, toggleInList, capitalize, GENDERS, EMPTY_ADVANCED, type ExploreSearch } from "@/lib/exploreFilters";
import { useExploreFacets } from "@/hooks/useExploreFacets";
import { ExploreFiltersSheet, Chip } from "@/components/explore/ExploreFiltersSheet";
import { useProductFeed } from "@/hooks/useProductFeed";
import { formatMZN } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useCity } from "@/contexts/CityContext";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { CategoryIcon } from "@/lib/categoryIcons";
import { Search, Heart, Loader2, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { thumbUrl } from "@/lib/imageUrl";
import { getProductDiscount } from "@/lib/productPrice";
import { productImageMetadata } from "@/lib/productImageCache";

export const Route = createFileRoute("/explorar")({
  validateSearch: zodValidator(exploreSearchSchema),
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
  const sp = Route.useSearch();
  const { genero: gender } = sp;
  const navigate = useNavigate({ from: Route.fullPath });
  const update = (patch: Partial<ExploreSearch>) => void navigate({ search: prev => ({ ...prev, ...patch }), replace: true, resetScroll: false });
  const [text, setText] = useState(sp.q);
  useEffect(() => { setText(sp.q); }, [sp.q]);
  useEffect(() => { if (text === sp.q) return; const t = setTimeout(() => update({ q: text }), 300); return () => clearTimeout(t); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  const searchDebounced = sp.q;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const facets = useExploreFacets();
  const hints = useMemo(() => Array.from(new Set([...facets.suggestions, ...cats.map(c => c.label)])).filter(Boolean), [facets.suggestions, cats]);
  const [hint, setHint] = useState(0);
  useEffect(() => { if (text || hints.length < 2) return; const t = setInterval(() => setHint(h => (h + 1) % hints.length), 3200); return () => clearInterval(t); }, [text, hints.length]);
  const advanced = countAdvanced(sp);
  const catList = sp.categoria === "all" ? [] : splitList(sp.categoria);
  const hasActiveFilters = !!searchDebounced.trim() || catList.length > 0 || gender !== "all" || advanced > 0;
  const explore = useMemo(() => exploreRpcArgs(sp, city), [sp, city]);
  const { items, loading, loadingMore, error, retry, sentinelRef } = useProductFeed({ search: "", category: "all", city, explore });
  const sellerName = facets.sellers.find(s => s.id === sp.loja)?.name;
  const active: { key: string; label: string; clear: () => void }[] = [];
  if (sp.min || sp.max) active.push({ key: "p", label: sp.min && sp.max ? `${sp.min}–${sp.max} MT` : sp.min ? `Mín: ${sp.min} MT` : `Máx: ${sp.max} MT`, clear: () => update({ min: "", max: "" }) });
  if (sp.desconto) active.push({ key: "d", label: "Com desconto", clear: () => update({ desconto: false }) });
  if (sp.stock) active.push({ key: "s", label: "Disponível", clear: () => update({ stock: false }) });
  if (sp.unica) active.push({ key: "u", label: "Peça única", clear: () => update({ unica: false }) });
  if (catList.length > 1) for (const c of catList) active.push({ key: "c" + c, label: cats.find(x => x.slug === c)?.label ?? c, clear: () => update({ categoria: toggleInList(sp.categoria, c) || "all" }) });
  for (const t of splitList(sp.tamanhos)) active.push({ key: "t" + t, label: `Tamanho ${t}`, clear: () => update({ tamanhos: toggleInList(sp.tamanhos, t) }) });
  for (const c of splitList(sp.cores)) active.push({ key: "k" + c, label: capitalize(c), clear: () => update({ cores: toggleInList(sp.cores, c) }) });
  if (sp.loja) active.push({ key: "l", label: sellerName ?? "Loja", clear: () => update({ loja: "" }) });
  const rail = "flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain";

  return (
    <div className="max-w-[1400px] mx-auto px-5 pt-3 pb-8 md:pt-6 md:pb-12">
      <div className="flex flex-col gap-2.5 mb-5">
        <div role="search" className="flex items-center h-12 rounded-2xl border border-border bg-card shadow-sm focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30 transition">
          <Search className="ml-4 w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
          <div className="relative flex-1 min-w-0 h-full">
            <input type="search" value={text} onChange={(e) => setText(e.target.value)} aria-label="Pesquisar peças" className="w-full h-full bg-transparent px-3 text-[15px] outline-none" />
            {!text && hints.length > 0 && (
              <span key={hint} aria-hidden className="pointer-events-none absolute inset-y-0 left-3 right-2 flex items-center text-[15px] text-muted-foreground truncate animate-in fade-in slide-in-from-bottom-1 duration-500">{hints[hint % hints.length]}…</span>
            )}
          </div>
          <button type="button" aria-label={advanced ? `Filtrar (${advanced} ativos)` : "Filtrar"} onClick={() => setFiltersOpen(true)} className="relative mr-1.5 h-9 w-9 shrink-0 rounded-xl bg-foreground text-background flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
            <SlidersHorizontal className="w-4 h-4" />
            {advanced > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-gold text-gold-foreground text-[11px] font-semibold flex items-center justify-center">{advanced}</span>}
          </button>
        </div>
        <div className={rail} aria-label="Género">
          {GENDERS.map(g => <Chip key={g.value} active={gender === g.value} onClick={() => update({ genero: g.value })}>{g.label}</Chip>)}
        </div>
        {cats.length > 0 && (
          <div className={rail} aria-label="Categorias">
            <Chip active={catList.length === 0} onClick={() => update({ categoria: "all" })}>Todos</Chip>
            {cats.map(c => <Chip key={c.slug} active={catList.length === 1 && catList[0] === c.slug} onClick={() => update({ categoria: c.slug })}><CategoryIcon icon={c.icon} className="w-4 h-4 mr-1 inline" />{c.label}</Chip>)}
          </div>
        )}
        {active.length > 0 && (
          <div className={rail} aria-label="Filtros ativos">
            {active.map(a => (
              <button key={a.key} type="button" onClick={a.clear} aria-label={`Remover ${a.label}`} className="shrink-0 h-8 px-3 rounded-full bg-gold/15 text-foreground border border-gold/40 text-xs whitespace-nowrap flex items-center gap-1">{a.label}<X className="w-3 h-3" /></button>
            ))}
            {active.length > 1 && <button type="button" onClick={() => update(EMPTY_ADVANCED)} className="shrink-0 h-8 px-3 text-xs underline text-muted-foreground">Limpar</button>}
          </div>
        )}
      </div>
      <ExploreFiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen} value={sp} categories={cats} city={city} onApply={(next) => update(next)} />

      {loading && items.length === 0 ? (
        <ProductMasonry className="mx-auto grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-start gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
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
                    <NaturalProductImage src={img ? thumbUrl(img) : null} alt={p.title} {...productImageMetadata(p.images)}>
                      {p.is_unique && (
                        <span className="absolute top-2 left-2 bg-gold text-ink text-[10px] tracking-wider px-2 py-1 rounded font-semibold">PEÇA ÚNICA</span>
                      )}
                    </NaturalProductImage>
                    <div className="p-3">
                      <h3 className="min-h-10 font-medium text-sm line-clamp-2 break-words">{p.title}</h3>
                      <div className="mt-0.5 min-h-5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm">
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
