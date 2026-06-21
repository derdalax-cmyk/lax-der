import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Truck, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCarousel } from "@/components/ProductCarousel";
import type { ProductCardData } from "@/components/ProductCard";

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
  const { data: featured = [] } = useQuery({
    queryKey: ["home-featured"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq("featured", true)
        .neq("status", "sold")
        .order("created_at", { ascending: false })
        .limit(12);
      return (data ?? []) as ProductCardData[];
    },
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["home-collections"],
    queryFn: async () => {
      const { data: cols } = await supabase
        .from("featured_collections")
        .select("id,name,slug,icon,sort_order")
        .order("sort_order", { ascending: true });
      if (!cols?.length) return [] as { id: string; name: string; icon: string | null; products: ProductCardData[] }[];

      const { data: links } = await supabase
        .from("featured_collection_products")
        .select("collection_id,product_id,sort_order")
        .order("sort_order", { ascending: true });

      const productIds = [...new Set((links ?? []).map((l) => l.product_id))];
      let products: ProductCardData[] = [];
      if (productIds.length) {
        const { data: prods } = await supabase
          .from("products")
          .select(PRODUCT_FIELDS)
          .in("id", productIds)
          .neq("status", "sold");
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
      <section className="relative bg-ink text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ background: "var(--gradient-dark)" }} />
        <div className="absolute top-1/2 -right-32 w-[600px] h-[600px] rounded-full bg-gold/20 blur-3xl -translate-y-1/2" />
        <div className="relative max-w-[1400px] mx-auto px-5 py-20 md:py-32 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/30 text-gold text-xs uppercase tracking-widest mb-6">
              <Sparkles className="w-3.5 h-3.5" /> Nova coleção
            </div>
            <h1 className="font-display text-4xl md:text-6xl leading-[1.05] mb-6">
              Moda com <span className="text-gold italic">história</span>, estilo com futuro.
            </h1>
            <p className="text-lg text-white/70 max-w-md mb-8 leading-relaxed">
              Peças únicas, selecionadas para você.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/explorar"
                className="inline-flex items-center gap-2 bg-gold text-ink px-6 py-3 rounded-md font-medium hover:bg-gold/90 transition-colors"
              >
                Explorar coleção <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/categorias"
                className="inline-flex items-center gap-2 border border-white/20 text-white px-6 py-3 rounded-md font-medium hover:bg-white/5 transition-colors"
              >
                Ver categorias
              </Link>
            </div>
          </div>

          <div className="hidden md:block relative">
            <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-white/10" style={{ background: "var(--gradient-gold)" }}>
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-display text-9xl text-ink/20">D</span>
              </div>
            </div>
          </div>
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
