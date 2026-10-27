import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gem, Truck, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCarousel } from "@/components/ProductCarousel";
import type { ProductCardData } from "@/components/ProductCard";
import { useCity } from "@/contexts/CityContext";
import { AboutDerdalaxCard } from "@/components/AboutDerdalax";
import { RoletaHome } from "@/components/roleta/RoletaHome";
import heroBg from "@/assets/hero-derdalax.jpeg.asset.json";
import { HomeHero } from "@/components/HomeHero";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Derdalax: compre sem sair de casa" },
      { name: "description", content: "Compre moda online na Derdalax, de forma simples e sem sair de casa." },
      { property: "og:title", content: "Derdalax: compre sem sair de casa" },
      { property: "og:description", content: "Compre moda online na Derdalax, de forma simples e sem sair de casa." },
      { property: "og:site_name", content: "Derdalax" },
      { property: "og:url", content: "https://derdalax.co.mz/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Derdalax: compre sem sair de casa" },
      { name: "twitter:description", content: "Compre moda online na Derdalax, de forma simples e sem sair de casa." },
    ],
    links: [
      { rel: "canonical", href: "https://derdalax.co.mz/" },
      { rel: "preload", as: "image", href: heroBg.url, fetchPriority: "high" },
    ],
  }),
  component: Home,
});


const PRODUCT_FIELDS = "id,title,base_price,original_price,images,is_unique,status,category";

function Home() {
  const { city } = useCity();



  const { data: featured = [], isPending: featuredPending } = useQuery({
    queryKey: ["home-featured", city],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      let q = supabase
        .from("public_products")
        .select(PRODUCT_FIELDS)
        .eq("featured", true)
        .neq("status", "sold");
      if (city) q = q.or(`city.eq.${city},city.is.null`);
      const { data } = await q
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(12);
      return (data ?? []) as ProductCardData[];
    },
  });

  const { data: collections = [], isPending: collectionsPending } = useQuery({
    queryKey: ["home-collections", city],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data: cols } = await supabase
        .from("featured_collections")
        .select("id,name,slug,icon,sort_order,starts_at,ends_at")
        .eq("is_active", true)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order("sort_order", { ascending: true }).order("id", { ascending: true });
      if (!cols?.length) return [] as { id: string; name: string; icon: string | null; products: ProductCardData[] }[];

      const { data: links } = await supabase
        .from("featured_collection_products")
        .select("collection_id,product_id,sort_order")
        .eq("status", "approved")
        .order("sort_order", { ascending: true }).order("product_id", { ascending: true });

      const productIds = [...new Set((links ?? []).map((l) => l.product_id))];
      let products: ProductCardData[] = [];
      if (productIds.length) {
        let pq = supabase
          .from("public_products")
          .select(PRODUCT_FIELDS)
          .in("id", productIds)
          .neq("status", "sold");
        if (city) pq = pq.or(`city.eq.${city},city.is.null`);
        const { data: prods } = await pq;
        products = (prods ?? []) as ProductCardData[];
      }
      const byId = new Map(products.map((p) => [p.id, p]));

      return cols.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        products: (links ?? [])
          .filter((l) => l.collection_id === c.id)
          .map((l) => byId.get(l.product_id))
          .filter((p): p is ProductCardData => !!p),
      }));
    },
  });

  const productsLoading = featuredPending || collectionsPending;
  const noCityProducts =
    !!city &&
    !productsLoading &&
    featured.length === 0 &&
    collections.every((c) => c.products.length === 0);

  return (

    <>
      <HomeHero />

      <RoletaHome />

      {productsLoading ? (
        <div className="max-w-[1400px] mx-auto px-5 pt-10">
          <div className="h-7 w-52 bg-secondary animate-pulse rounded mb-4" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[40%] sm:w-[28%] md:w-[20%] lg:w-[15%] xl:w-[12.5%]">
                <div className="aspect-square bg-secondary animate-pulse rounded-lg" />
                <div className="h-3 bg-secondary animate-pulse rounded mt-2" />
                <div className="h-3 w-2/3 bg-secondary animate-pulse rounded mt-1.5" />
              </div>
            ))}
          </div>
        </div>
      ) : noCityProducts ? (
        <div className="max-w-[1400px] mx-auto px-5 py-16 text-center">
          <p className="text-muted-foreground">Nenhuma peça encontrada.</p>
        </div>
      ) : (
        <>
          {/* DESTAQUES DA SEMANA */}
          <div className="pt-8">
            <ProductCarousel
              title="Destaques da semana"
              products={featured}
              seeMoreTo="/explorar"
              seeMoreLabel="Ver tudo"
            />
          </div>
        </>
      )}

      {/* COLEÇÕES DE DESTAQUE (admin) */}
      {collections.map((c) => (
        <ProductCarousel
          key={c.id}
          title={c.name}
          icon={c.icon ?? undefined}
          products={c.products}
          seeMoreTo="/explorar"
          seeMoreLabel="Ver tudo"
        />
      ))}

      {/* FEATURES */}
      <section className="py-16 border-t border-border mt-6">
        <div className="max-w-[1400px] mx-auto px-5 grid md:grid-cols-3 gap-8">
          {[
            { icon: Truck, title: "Entrega rápida", desc: "Em todas as principais cidades de Moçambique." },
            { icon: ShieldCheck, title: "Pagamento flexível", desc: "Combine com o vendedor via chat ou pague na entrega." },
            { icon: Gem, title: "Peças únicas", desc: "Coleções limitadas que ninguém mais terá." },
          ].map((f) => (
            <div key={f.title} className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <f.icon className="w-5 h-5 text-ink" />
              </div>
              <div>
                <h3 className="font-display text-lg mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <AboutDerdalaxCard />
    </>
  );
}
