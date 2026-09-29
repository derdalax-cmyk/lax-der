import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type ProductCardData, formatMZN } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useCity } from "@/contexts/CityContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { CategoryIcon } from "@/lib/categoryIcons";
import { Search, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { thumbUrl } from "@/lib/imageUrl";
import { getProductDiscount } from "@/lib/productPrice";

export const Route = createFileRoute("/explorar")({
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

const PAGE_SIZE = 24;

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
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [category, setCategory] = useState("all");
  const [gender, setGender] = useState("all");

  const hasActiveFilters = !!searchDebounced.trim() || category !== "all" || gender !== "all";


  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); setItems([]); }, [searchDebounced, category, gender, city]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      let q = supabase
        .from("products")
        .select("id,title,base_price,original_price,images,is_unique,status,category")
        .neq("status", "sold");

      if (searchDebounced.trim()) q = q.ilike("title", `%${searchDebounced.trim()}%`);
      if (category !== "all") q = q.eq("category", category);
      if (gender !== "all") q = q.ilike("description", `%"gender":"${gender}"%`);
      if (city) q = q.or(`city.eq.${city},city.is.null`);
      q = q.order("created_at", { ascending: false });

      const from = page * PAGE_SIZE;
      q = q.range(from, from + PAGE_SIZE - 1);

      const { data } = await q;
      if (cancelled) return;
      const rows = (data ?? []) as ProductCardData[];
      setItems((prev) => (page === 0 ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [page, searchDebounced, category, gender, city]);

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
        <div className="mx-auto columns-2 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 sm:gap-4 [column-fill:_balance]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="mb-4 bg-secondary animate-pulse rounded-xl" style={{ height: 180 + (i % 4) * 60 }} />
          ))}
        </div>
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
          <div className="mx-auto columns-2 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 sm:gap-4 [column-fill:_balance]">
            {items.map((p) => {
              const img = firstImage(p.images);
              const fav = isFavorite(p.id);
              const discount = getProductDiscount(Number(p.base_price), p.original_price);
              return (
                <div key={p.id} className="mb-4 break-inside-avoid group relative">
                  <Link to="/produto/$id" params={{ id: p.id }} className="block rounded-xl overflow-hidden border border-border bg-card">
                    <div className="relative w-full overflow-hidden bg-secondary">
                      {img ? (
                        <img src={thumbUrl(img)} alt={p.title} loading="lazy" className="block w-full h-auto" />
                      ) : (
                        <div className="w-full aspect-square flex items-center justify-center text-muted-foreground text-xs">Sem imagem</div>
                      )}
                      {p.is_unique && (
                        <span className="absolute top-2 left-2 bg-gold text-ink text-[10px] tracking-wider px-2 py-1 rounded font-semibold">PEÇA ÚNICA</span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-sm line-clamp-1">{p.title}</h3>
                      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm">
                        <span className="text-muted-foreground">{formatMZN(Number(p.base_price))}</span>
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
          </div>
          {hasMore && (
            <div className="flex justify-center mt-8">
              <Button variant="outline" disabled={loading} onClick={() => setPage((p) => p + 1)}>
                {loading ? "A carregar…" : "Ver mais"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
