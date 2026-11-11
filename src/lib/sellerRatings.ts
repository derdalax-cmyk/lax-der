import type { QueryClient } from "@tanstack/react-query";

export type PublicSeller = {
  id: string;
  store_name: string;
  logo_url: string | null;
  city: string | null;
  province: string | null;
  description: string | null;
  rating: number | null;
  total_reviews: number | null;
  created_at: string;
  product_count: number;
};

/** Only formats the server aggregate; never derives a rating in the browser. */
export function sellerRatingSummary(seller: Pick<PublicSeller, "rating" | "total_reviews">) {
  const rating = Number(seller.rating ?? 0);
  const total = Number(seller.total_reviews ?? 0);
  return { rating, average: rating.toFixed(1), reviews: `${total} ${total === 1 ? "avaliação" : "avaliações"}` };
}

export async function invalidateSellerRatings(client: QueryClient, sellerId: string) {
  await Promise.all([
    ...["seller-reviews", "seller-breakdown", "public-seller", "my-seller-review"].map(key =>
      client.invalidateQueries({ queryKey: [key, sellerId], refetchType: "all" })),
    client.invalidateQueries({
      predicate: query => query.queryKey[0] === "public-product-details" &&
        (query.state.data as { product?: { seller_id?: string | null } } | undefined)?.product?.seller_id === sellerId,
      refetchType: "all",
    }),
  ]);
}