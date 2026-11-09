import { imageUrl } from "@/lib/imageUrl";
import type { ProductCardData } from "@/components/ProductCard";

export type PublicProduct = Omit<ProductCardData, "images"> & {
  images: string[];
  description: string | null;
  shipping_fee: number | null;
  reserved_until: string | null;
  seller_id: string | null;
  city: string | null;
};

export function primaryProductImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const first = images[0];
  const url = typeof first === "string" ? first : first && typeof first === "object" && "url" in first ? first.url : null;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

export function productPageHead(id: string, product: PublicProduct | null) {
  const title = product ? `${product.title} · Derdalax` : "Produto não encontrado · Derdalax";
  const description = product?.description?.replace(/<!--META:.*?-->/gs, "").trim().slice(0, 160) || "Veja esta peça e compre online na Derdalax.";
  const url = `https://derdalax.co.mz/produto/${encodeURIComponent(id)}`;
  const primary = primaryProductImage(product?.images);
  const image = primary ? imageUrl(primary, { width: 1200, height: 630, quality: 75, resize: "cover" }) : null;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export function recommendationSections<T extends ProductCardData>(currentId: string, related: T[], seller: T[]) {
  const unique = (rows: T[]) => [...new Map(rows.filter(p => p.id !== currentId && p.status !== "sold").map(p => [p.id, p])).values()];
  const sellerProducts = unique(seller).slice(0, 50);
  const sellerIds = new Set(sellerProducts.map(p => p.id));
  return { sellerProducts, related: unique(related).filter(p => !sellerIds.has(p.id)).slice(0, 30) };
}

export async function shareProduct(product: Pick<ProductCardData, "id" | "title" | "images">, api: Pick<Navigator, "share" | "canShare" | "clipboard"> = navigator, fetchImage: typeof fetch = fetch) {
  const url = `https://derdalax.co.mz/produto/${product.id}`;
  const payload: ShareData = { title: product.title, text: `Vê isto na Derdalax: ${product.title}`, url };
  if (typeof api.share !== "function") {
    await api.clipboard.writeText(url);
    return "copied";
  }
  const image = primaryProductImage(product.images);
  if (image && typeof api.canShare === "function") {
    try {
      const response = await fetchImage(image);
      if (!response.ok) throw new Error("image_unavailable");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("invalid_image");
      const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      const file = new File([blob], `derdalax-${product.id}.${extension}`, { type: blob.type });
      if (api.canShare({ files: [file] })) {
        try {
          await api.share({ ...payload, files: [file] });
          return "image";
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return "cancelled";
        }
      }
    } catch { /* CORS/offline/unsupported file: share the canonical product link. */ }
  }
  await api.share(payload);
  return "link";
}