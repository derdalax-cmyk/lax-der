import { Link } from "@tanstack/react-router";
import { ArrowRight, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { thumbUrl } from "@/lib/imageUrl";
import { formatMZN, type ProductCardData } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/useFavorites";
import { CategoryIcon } from "@/lib/categoryIcons";
import { getProductDiscount, getRoletaLine } from "@/lib/productPrice";
import { useRoleta } from "@/hooks/useRoleta";


function firstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) return String((first as { url: unknown }).url);
  }
  return null;
}

type Props = {
  title: string;
  icon?: string;
  products: ProductCardData[];
  seeMoreTo?: string;
  seeMoreLabel?: string;
  seeMoreSearch?: Record<string, string>;
};

export function ProductCarousel({ title, icon, products, seeMoreTo, seeMoreLabel, seeMoreSearch }: Props) {
  const { isFavorite, toggle } = useFavorites();
  const { rewardFor } = useRoleta();
  if (!products.length) return null;

  return (
    <section className="py-6">
      <div className="max-w-[1400px] mx-auto px-5 flex items-end justify-between mb-4">
        <h2 className="font-display text-xl md:text-2xl flex items-center gap-2">
          {icon && <CategoryIcon icon={icon} className="w-6 h-6" />} {title}
        </h2>

        {seeMoreTo && (
          <Link
            to={seeMoreTo as "/produtos"}
            search={seeMoreSearch as never}
            className="text-sm font-medium text-muted-foreground hover:text-gold inline-flex items-center gap-1 shrink-0"
          >
            {seeMoreLabel ?? "Ver tudo"} <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div id={`carousel-${encodeURIComponent(title)}`} className="flex gap-3 overflow-x-auto px-5 pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {products.map((p) => {
          const img = firstImage(p.images);
          const fav = isFavorite(p.id);
          const activeReward = rewardFor(p.id);
          const roletaOn = !!activeReward;
          const roleta = roletaOn ? getRoletaLine(Number(p.base_price), Number(p.base_price), p.original_price, 1, activeReward) : null;
          const shownPrice = roleta?.applies ? roleta.unitFinal : Number(p.base_price);
          const discount = roleta?.applies
            ? getProductDiscount(shownPrice, Math.max(Number(p.original_price ?? 0), Number(p.base_price)))
            : getProductDiscount(Number(p.base_price), p.original_price);
          return (
            <div
              key={p.id}
              className="snap-start shrink-0 w-[40%] sm:w-[28%] md:w-[20%] lg:w-[15%] xl:w-[12.5%] group relative bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <Link to="/produto/$id" params={{ id: p.id }} state={{ productOrigin: true }} className="block">
                <div className="relative aspect-square bg-secondary overflow-hidden">
                  {img ? (
                    <img src={thumbUrl(img)} alt={p.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover object-center" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem imagem</div>
                  )}
                  {(p.is_unique || roletaOn) && (
                    <div className="absolute top-1.5 left-1.5 flex flex-col items-start gap-0.5">
                      {p.is_unique && <span className="bg-gold text-ink text-[9px] tracking-wide px-1.5 py-0.5 rounded font-semibold">PEÇA ÚNICA</span>}
                      {activeReward && <span className="bg-ink text-gold border border-gold/60 text-[9px] tracking-wide px-1.5 py-0.5 rounded font-semibold">🎁 -{activeReward.percent}% ROLETA</span>}
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <h3 className="font-medium text-xs line-clamp-1">{p.title}</h3>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-xs">
                    <span className="text-gold font-semibold">{formatMZN(shownPrice)}</span>
                    {discount && <span className="text-[10px] text-muted-foreground line-through">{formatMZN(discount.originalPrice)}</span>}
                    {discount && <span className="text-[10px] font-medium text-destructive">-{discount.discountPercent}%</span>}
                  </div>
                </div>
              </Link>

              <button
                type="button"
                aria-label="Favoritar"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(p.id); }}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background border border-border"
              >
                <Heart className={cn("w-3.5 h-3.5", fav ? "fill-destructive text-destructive" : "text-foreground")} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
