import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCity } from "@/contexts/CityContext";
import { CategoryIcon } from "@/lib/categoryIcons";

export const Route = createFileRoute("/categorias")({
  head: () => ({ meta: [
    { title: "Categorias · DERDALAX" },
    { name: "description", content: "Explore as categorias da loja DERDALAX: camisas, calças, sapatos e mais." },
  ]}),
  component: CategoriasPage,
});

type Cat = { id: string; slug: string; label: string; icon: string | null; sort_order: number };

function CategoriasPage() {
  const { city } = useCity();

  const { data: categories = [] } = useQuery({
    queryKey: ["public-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories")
        .select("id,slug,label,icon,sort_order").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return (data ?? []) as Cat[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["category-counts", city, categories.map((c) => c.slug).join(",")],
    enabled: categories.length > 0,
    queryFn: async () => {
      const result: Record<string, number> = {};
      await Promise.all(categories.map(async (c) => {
        let q = supabase.from("products").select("id", { count: "exact", head: true })
          .eq("category", c.slug).neq("status", "sold");
        if (city) q = q.or(`city.eq.${city},city.is.null`);
        const { count } = await q;
        result[c.slug] = count ?? 0;
      }));
      return result;
    },
  });

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-5 py-6 md:py-12">
      <header className="mb-6 md:mb-8">
        <h1 className="font-display text-3xl md:text-5xl">Categorias</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">Encontre a peça certa por categoria.</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {categories.map((c) => (
          <Link
            key={c.slug}
            to="/produtos"
            search={{ categoria: c.slug }}
            className="group bg-card border border-border rounded-2xl p-4 md:p-6 flex items-center gap-3 md:gap-4 hover:border-gold hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-secondary grid place-items-center shrink-0 group-hover:bg-gold/10 transition-colors">
              <CategoryIcon icon={c.icon} className="w-6 h-6 md:w-7 md:h-7 text-ink" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base md:text-xl truncate">{c.label}</h2>
              <p className="text-xs md:text-sm text-muted-foreground">{counts[c.slug] ?? 0} peças</p>
            </div>
          </Link>
        ))}
        {categories.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground py-12">Sem categorias disponíveis.</p>
        )}
      </div>
    </div>
  );
}
