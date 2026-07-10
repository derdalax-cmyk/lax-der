import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Truck, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCarousel } from "@/components/ProductCarousel";
import type { ProductCardData } from "@/components/ProductCard";
import { useCity } from "@/contexts/CityContext";
import heroBg from "@/assets/hero-derdalax.jpeg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DERDALAX · Moda com história, estilo com futuro" },
      { name: "description", content: "Peças únicas, selecionadas para você. Descubra a coleção DERDALAX e receba em todo o Moçambique." },
      { property: "og:title", content: "DERDALAX · Moda com história, estilo com futuro" },
      { property: "og:description", content: "Peças únicas, selecionadas para você." },
    ],
  }),
  component: Home,
});

const PRODUCT_FIELDS = "id,title,base_price,images,is_unique,status,category";

function Home() {
  const { city } = useCity();
  const noCityProducts =
    !!city && featured.length === 0 && collections.every((c) => c.products.length === 0);


  const { data: featured = [] } = useQuery({
    queryKey: ["home-featured", city],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq("featured", true)
        .neq("status", "sold");
      if (city) q = q.or(`city.eq.${city},city.is.null`);
      const { data } = await q
        .order("created_at", { ascending: false })
        .limit(12);
      return (data ?? []) as ProductCardData[];
    },
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["home-collections", city],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data: cols } = await supabase
        .from("featured_collections")
        .select("id,name,slug,icon,sort_order,starts_at,ends_at")
        .eq("is_active", true)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order("sort_order", { ascending: true });
      if (!cols?.length) return [] as { id: string; name: string; icon: string | null; products: ProductCardData[] }[];

      const { data: links } = await supabase
        .from("featured_collection_products")
        .select("collection_id,product_id,sort_order")
        .eq("status", "approved")
        .order("sort_order", { ascending: true });

      const productIds = [...new Set((links ?? []).map((l) => l.product_id))];
      let products: ProductCardData[] = [];
      if (productIds.length) {
        let pq = supabase
          .from("products")
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

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <img
          src={heroBg.url}
          alt="Arara de roupas DERDALAX com iluminação quente"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* overlay de cor sólida transparente para legibilidade */}
        <div className="absolute inset-0 bg-ink/65" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />

        <div className="relative max-w-[1400px] mx-auto px-5 py-14 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/40 text-gold text-xs uppercase tracking-widest mb-5 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5" /> Nova coleção
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-6xl leading-[1.05] mb-4 text-white animate-fade-in">
            Moda com <span className="text-gold italic">história</span>, estilo com futuro.
          </h1>
          <p
            className="text-base md:text-lg text-white/85 max-w-md mx-auto leading-relaxed animate-fade-in"
            style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
          >
            Peças únicas, selecionadas para você.
          </p>
        </div>
      </section>

      {/* DESTAQUES DA SEMANA */}
      <div className="pt-8">
        <ProductCarousel
          title="Destaques da semana"
          icon="⭐"
          products={featured}
          seeMoreTo="/explorar"
          seeMoreLabel="Ver tudo"
        />
      </div>

      {/* COLEÇÕES DE DESTAQUE (admin) */}
      {collections.map((c) => (
        <ProductCarousel
          key={c.id}
          title={c.name}
          icon={c.icon ?? undefined}
          products={c.products}
          seeMoreTo="/explorar"
          seeMoreLabel="Ver mais"
        />
      ))}

      {/* FEATURES */}
      <section className="py-16 border-t border-border mt-6">
        <div className="max-w-[1400px] mx-auto px-5 grid md:grid-cols-3 gap-8">
          {[
            { icon: Truck, title: "Entrega rápida", desc: "Em todas as principais cidades de Moçambique." },
            { icon: ShieldCheck, title: "Pagamento seguro", desc: "e-Mpesa e e-Mola integrados." },
            { icon: Sparkles, title: "Peças únicas", desc: "Coleções limitadas que ninguém mais terá." },
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
    </>
  );
}
