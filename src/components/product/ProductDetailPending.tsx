import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { NaturalProductImage } from "./NaturalProductImage";
import { primaryProductImage } from "@/lib/productDetails";
import { mainUrl } from "@/lib/imageUrl";
import { formatMZN, type ProductCardData } from "@/components/ProductCard";

export function ProductDetailPending() {
  const client = useQueryClient();
  const href = useRouterState({ select: state => state.resolvedLocation?.href === state.location.href ? state.location.href : state.location.href });
  const id = href.split("/produto/")[1]?.split(/[?#/]/)[0];
  let product: ProductCardData | undefined;
  if (id) {
    for (const query of client.getQueryCache().findAll()) {
      const value = query.state.data as { pages?: ProductCardData[][]; product?: ProductCardData } | ProductCardData[] | undefined;
      const rows = Array.isArray(value) ? value : value?.pages?.flat() ?? (value?.product ? [value.product] : []);
      product = rows.find(row => row.id === id);
      if (product) break;
    }
  }
  const image = primaryProductImage(product?.images);
  return <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-5 py-10 md:py-14 overflow-x-hidden" aria-busy="true">
    <div className="h-9 mb-6" />
    <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
      <NaturalProductImage src={image ? mainUrl(image) : null} alt={product?.title ?? ""} loading="eager" />
      <div className="space-y-3">
        {product ? <><h1 className="font-display text-2xl sm:text-3xl md:text-4xl break-words">{product.title}</h1><p className="text-gold font-semibold">{formatMZN(product.base_price)}</p></> : <><div className="h-16 bg-secondary rounded animate-pulse" /><div className="h-8 w-1/3 bg-secondary rounded animate-pulse" /></>}
        <div className="h-24 bg-secondary rounded animate-pulse" />
      </div>
    </div>
  </div>;
}