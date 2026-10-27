import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { ProductMasonry } from "@/components/product/ProductMasonry";
import { useFavorites } from "@/hooks/useFavorites";

export const Route = createFileRoute("/campanha/$id")({
  head: () => ({ meta: [
    { title: "Seleção especial · Derdalax" },
    { name: "description", content: "Peças selecionadas pela equipa Derdalax." },
    { property: "og:title", content: "Seleção especial · Derdalax" },
    { property: "og:description", content: "Peças selecionadas pela equipa Derdalax." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CampanhaPage,
});

function CampanhaPage() {
  const { id } = Route.useParams();
  const { isFavorite, toggle } = useFavorites();
  const { data, isPending } = useQuery({
    queryKey: ["public-campaign", id],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: c } = await supabase.rpc("get_public_campaign", { _id: id });
      const camp = c as { title: string; body: string; product_ids: string[] } | null;
      if (!camp) return null;
      const ids = camp.product_ids ?? [];
      const { data: rows } = ids.length
        ? await supabase.from("public_products").select("id,title,base_price,original_price,images,is_unique,status,category").in("id", ids)
        : { data: [] };
      const list = ids.map((pid) => (rows ?? []).find((r) => r.id === pid)).filter(Boolean) as ProductCardData[];
      return { ...camp, products: list };
    },
  });
  return (
    <div className="max-w-[1400px] mx-auto px-5 py-8 md:py-12">
      {isPending ? <p className="text-muted-foreground">A carregar…</p> : !data ? (
        <div className="text-center py-20"><p className="text-muted-foreground">Esta seleção já não está disponível.</p><Link to="/explorar" className="text-gold underline mt-3 inline-block">Explorar peças</Link></div>
      ) : (
        <>
          <header className="mb-6"><h1 className="font-display text-3xl md:text-4xl">{data.title}</h1><p className="text-muted-foreground mt-2">{data.body}</p></header>
          <ProductMasonry className="mx-auto grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-start gap-3 sm:gap-4">
            {data.products.map((p) => <ProductCard key={p.id} product={p} isFavorite={isFavorite(p.id)} onToggleFavorite={toggle} />)}
          </ProductMasonry>
        </>
      )}
    </div>
  );
}
