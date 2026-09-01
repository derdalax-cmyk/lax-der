import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useCity } from "@/contexts/CityContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { Search } from "lucide-react";

const searchSchema = z.object({
  categoria: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/produtos")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [
    { title: "Produtos · DERDALAX" },
    { name: "description", content: "Explore a coleção DERDALAX — peças únicas e selecionadas." },
  ]}),
  component: ProdutosPage,
});

const PAGE_SIZE = 10;

function ProdutosPage() {
  const { categories: catList } = useCategories();
  const { categoria } = Route.useSearch();
  const { isFavorite, toggle } = useFavorites();
  const { city } = useCity();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [category, setCategory] = useState<string>(categoria || "all");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  useEffect(() => { setCategory(categoria || "all"); }, [categoria]);


  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [searchDebounced, category, minPrice, maxPrice, city]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      let q = supabase
        .from("products")
        .select("id,title,base_price,images,is_unique,status,category", { count: "exact" })
        .neq("status", "sold")
        .order("created_at", { ascending: false });

      if (searchDebounced.trim()) q = q.ilike("title", `%${searchDebounced.trim()}%`);
      if (category !== "all") q = q.eq("category", category);
      const min = Number(minPrice); if (minPrice && !isNaN(min)) q = q.gte("base_price", min);
      const max = Number(maxPrice); if (maxPrice && !isNaN(max)) q = q.lte("base_price", max);
      if (city) q = q.or(`city.eq.${city},city.is.null`);

      const from = (page - 1) * PAGE_SIZE;
      q = q.range(from, from + PAGE_SIZE - 1);

      const { data, count } = await q;
      if (cancelled) return;
      setProducts((data ?? []) as ProductCardData[]);
      setTotal(count ?? 0);
      setLoading(false);
    };
    fetchData();
    return () => { cancelled = true; };
  }, [page, searchDebounced, category, minPrice, maxPrice, city]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const clearFilters = () => {
    setSearch(""); setCategory("all"); setMinPrice(""); setMaxPrice("");
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-secondary animate-pulse rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">Nenhum produto encontrado.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} isFavorite={isFavorite(p.id)} onToggleFavorite={toggle} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
              <span className="text-sm text-muted-foreground px-3">Página {page} de {totalPages}</span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Seguinte</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
