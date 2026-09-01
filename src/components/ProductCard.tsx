import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { thumbUrl } from "@/lib/imageUrl";

export type ProductCardData = {
  id: string;
  title: string;
  base_price: number;
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
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(v) + " MT";
}

type Props = {
  product: ProductCardData;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
};

export function ProductCard({ product, isFavorite, onToggleFavorite }: Props) {
  const img = firstImage(product.images);
  return (
    <div className="group relative bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <Link to="/produto/$id" params={{ id: product.id }} className="block">
        <div className="relative aspect-square bg-secondary overflow-hidden">
          {img ? (
            <img src={thumbUrl(img)} alt={product.title} loading="lazy" className="absolute inset-0 w-full h-full object-contain p-1.5" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem imagem</div>
          )}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.is_unique && (
              <span className="bg-gold text-ink text-[10px] tracking-wider px-2 py-1 rounded font-semibold">PEÇA ÚNICA</span>
            )}
            {product.status === "reserved" && (
              <span className="bg-foreground text-background text-[10px] tracking-wider px-2 py-1 rounded font-semibold">RESERVADO</span>
            )}
            {product.status === "sold" && (
              <span className="bg-destructive text-destructive-foreground text-[10px] tracking-wider px-2 py-1 rounded font-semibold">VENDIDO</span>
            )}
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-medium text-sm line-clamp-1">{product.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{formatMZN(Number(product.base_price))}</p>
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
