import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import heroBg from "@/assets/hero-derdalax.jpeg.asset.json";

type Banner = { id: string; title: string; image_url: string; subtitle: string | null; alt: string | null; link_url: string | null; cta_label: string | null };

const FALLBACK: Banner = {
  id: "fallback",
  title: "Conectamos-te ao que procuras.",
  image_url: heroBg.url,
  subtitle: "Peças únicas, selecionadas para você.",
  alt: "Arara de roupas DERDALAX com iluminação quente",
  link_url: null,
  cta_label: null,
};
const INTERVAL_MS = 5500;

export function HomeHero() {
  const { data } = useQuery({
    queryKey: ["home-banners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("home_banners")
        .select("id,title,image_url,subtitle,alt,link_url,cta_label")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as Banner[];
    },
    staleTime: 5 * 60_000,
  });
  const slides = data && data.length ? data : [FALLBACK];
  const n = slides.length;
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => { if (idx >= n) setIdx(0); }, [n, idx]);
  useEffect(() => {
    if (n < 2 || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), INTERVAL_MS);
    return () => clearInterval(t);
  }, [n, paused]);

  const cur = slides[Math.min(idx, n - 1)];
  const isExternal = (u: string) => /^https?:\/\//i.test(u);

  return (
    <section
      className="relative overflow-hidden h-[180px] sm:h-[200px] md:h-[230px]"
      aria-roledescription={n > 1 ? "carrossel" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((b, i) => (
        <img
          key={b.id}
          src={b.image_url}
          alt={b.alt || b.subtitle || "Banner DERDALAX"}
          aria-hidden={i !== idx}
          fetchPriority={i === 0 ? "high" : "low"}
          loading={i === 0 ? "eager" : "lazy"}
          decoding="async"
          className={cn("absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out", i === idx ? "opacity-100" : "opacity-0")}
        />
      ))}
      {(() => {
        const hasTitle = !!cur.title?.trim();
        const hasSubtitle = !!cur.subtitle?.trim();
        if (!hasTitle && !hasSubtitle) return null;
        return (
          <>
            <div className="absolute inset-0 bg-ink/65" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />
            <div className="relative h-full max-w-[1400px] mx-auto px-5 flex flex-col items-center justify-center text-center">
              {hasTitle && (
                <h1 key={`title-${cur.id}`} className="font-display text-3xl sm:text-4xl md:text-5xl leading-[1.05] mb-3 text-primary-foreground max-w-4xl break-words line-clamp-3 animate-fade-in" aria-live={n > 1 ? "polite" : undefined}>
                  {cur.id === FALLBACK.id ? <>Conectamos-te ao <span className="text-gold italic">que procuras.</span></> : cur.title}
                </h1>
              )}
              {hasSubtitle && (
                <p key={cur.id} className="text-sm md:text-lg text-white/85 max-w-md mx-auto leading-relaxed animate-fade-in" aria-live={n > 1 ? "polite" : undefined}>
                  {cur.subtitle}
                </p>
              )}
            </div>
          </>
        );
      })()}
      {cur.link_url && cur.cta_label && (
        <div className="absolute bottom-6 inset-x-0 flex justify-center">
          {isExternal(cur.link_url) ? (
            <a href={cur.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full bg-gold text-ink px-5 py-2 text-sm font-semibold hover:bg-gold/90">{cur.cta_label}</a>
          ) : (
            <a href={cur.link_url} className="inline-flex items-center rounded-full bg-gold text-ink px-5 py-2 text-sm font-semibold hover:bg-gold/90">{cur.cta_label}</a>
          )}
        </div>
      )}

      {n > 1 && (
        <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
          {slides.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Ver banner ${i + 1} de ${n}`}
              aria-current={i === idx}
              onClick={() => setIdx(i)}
              className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-6 bg-gold" : "w-2 bg-white/50 hover:bg-white/80")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
