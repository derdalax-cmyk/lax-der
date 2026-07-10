import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCity } from "@/contexts/CityContext";
import { CATEGORY_META } from "@/lib/categories";

export const Route = createFileRoute("/categorias")({
  head: () => ({ meta: [
    { title: "Categorias · DERDALAX" },
    { name: "description", content: "Explore as categorias da loja DERDALAX: camisas, calças, sapatos e mais." },
  ]}),
  component: CategoriasPage,
});

function CategoriasPage() {
  const { data: counts = {} } = useQuery({
    queryKey: ["category-counts"],
    queryFn: async () => {
      const result: Record<string, number> = {};
      await Promise.all(
        CATEGORY_META.map(async (c) => {
          const { count } = await supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("category", c.slug)
            .neq("status", "sold");
          result[c.slug] = count ?? 0;
        }),
      );
      return result;
    },
  });

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-8 md:py-12">
      <header className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl">Categorias</h1>
        <p className="text-muted-foreground mt-2">Encontre a peça certa por categoria.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {CATEGORY_META.map((c) => (
          <Link
            key={c.slug}
            to="/produtos"
            search={{ categoria: c.slug }}
            className="group bg-card border border-border rounded-2xl p-6 flex items-center gap-4 hover:border-gold hover:shadow-md transition-all"
          >
            <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center text-3xl shrink-0 group-hover:bg-gold/10 transition-colors">
              {c.icon}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xl">{c.label}</h2>
              <p className="text-sm text-muted-foreground">{counts[c.slug] ?? 0} peças</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
