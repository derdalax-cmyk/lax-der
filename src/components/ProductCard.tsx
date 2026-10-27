import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { thumbUrl } from "@/lib/imageUrl";
import { getProductDiscount, getRoletaLine } from "@/lib/productPrice";
import { useRoleta } from "@/hooks/useRoleta";
import { NaturalProductImage } from "@/components/product/NaturalProductImage";

export type ProductCardData = {
  id: string;
  title: string;
  base_price: number;
  original_price: number | null;
  images: unknown;
  is_unique: boolean;
  status: "available" | "reserved" | "sold";
  category: string | null;
};

function firstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) return String((first as { url: unknown }).url);
  }
  return null;
}

export function formatMZN(v: number): string {
  return new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v)) + " MT";
}

type Props = {
  product: ProductCardData;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
};

export function ProductCard({ product, isFavorite, onToggleFavorite }: Props) {
  const img = firstImage(product.images);
  const { rewardFor } = useRoleta();
  const activeReward = rewardFor(product.id);
  const roleta = activeReward
    ? getRoletaLine(Number(product.base_price), Number(product.base_price), product.original_price, 1, activeReward)
    : null;
  const shownPrice = roleta?.applies ? roleta.unitFinal : Number(product.base_price);
  const discount = roleta?.applies
    ? getProductDiscount(shownPrice, Math.max(Number(product.original_price ?? 0), Number(product.base_price)))
    : getProductDiscount(Number(product.base_price), product.original_price);
  return (
    <div data-product-id={product.id} className="group relative min-w-0 bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <Link to="/produto/$id" params={{ id: product.id }} state={{ productOrigin: true }} className="block">
        <NaturalProductImage src={img ? thumbUrl(img) : null} alt={product.title}>
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.is_unique && (
              <span className="bg-gold text-ink text-[10px] tracking-wider px-2 py-1 rounded font-semibold">PEÇA ÚNICA</span>
            )}
            {activeReward && (
              <span className="self-start bg-ink text-gold border border-gold/60 text-[10px] tracking-wider px-2 py-0.5 rounded font-semibold">🎁 -{activeReward.percent}% ROLETA</span>
            )}
            {product.status === "reserved" && (
              <span className="bg-foreground text-background text-[10px] tracking-wider px-2 py-1 rounded font-semibold">RESERVADO</span>
            )}
            {product.status === "sold" && (
              <span className="bg-destructive text-destructive-foreground text-[10px] tracking-wider px-2 py-1 rounded font-semibold">VENDIDO</span>
            )}
          </div>
        </NaturalProductImage>
        <div className="p-3">
          <h3 className="min-h-10 font-medium text-sm line-clamp-2 break-words">{product.title}</h3>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm min-w-0">
            <span data-product-price className="text-gold font-semibold break-words">{formatMZN(shownPrice)}</span>
            {discount && <span className="text-xs text-muted-foreground line-through">{formatMZN(discount.originalPrice)}</span>}
            {discount && <span className="text-xs font-medium text-destructive">-{discount.discountPercent}%</span>}
          </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label="Favoritar"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(product.id); }}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background border border-border"
      >
        <Heart className={cn("w-4 h-4", isFavorite ? "fill-destructive text-destructive" : "text-foreground")} />
      </button>
    </div>
  );
}
