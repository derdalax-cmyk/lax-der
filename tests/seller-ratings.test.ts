import { test, expect } from "bun:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { invalidateSellerRatings, sellerRatingSummary } from "../src/lib/sellerRatings";

test("zero reviews preserves the public zero average and count", () => {
  expect(sellerRatingSummary({ rating: 0, total_reviews: 0 })).toEqual({ rating: 0, average: "0.0", reviews: "0 avaliações" });
});

test("three reviews formats the server mean with one decimal without rounding its value", () => {
  expect(sellerRatingSummary({ rating: 14 / 3, total_reviews: 3 })).toEqual({ rating: 14 / 3, average: "4.7", reviews: "3 avaliações" });
});

for (const action of ["new", "edited", "removed"]) {
  test(`${action} review refreshes store and product seller summaries and all dependent keys`, async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const sellerId = "seller-a";
    let current = { rating: 4.2, total_reviews: 5 };
    const store = new QueryObserver(client, { queryKey: ["public-seller", sellerId], queryFn: async () => current, staleTime: Infinity });
    const product = new QueryObserver(client, { queryKey: ["public-seller", sellerId], queryFn: async () => current, staleTime: Infinity });
    const unStore = store.subscribe(() => {});
    const unProduct = product.subscribe(() => {});
    await store.refetch();
    for (const key of ["seller-reviews", "seller-breakdown", "my-seller-review"]) client.setQueryData([key, sellerId], []);
    client.setQueryData(["public-product-details", "product-a"], { product: { seller_id: sellerId } });
    client.setQueryData(["public-product-details", "product-b"], { product: { seller_id: "other" } });
    current = action === "removed" ? { rating: 4, total_reviews: 4 } : { rating: 4.3, total_reviews: action === "new" ? 6 : 5 };
    await invalidateSellerRatings(client, sellerId);
    expect(store.getCurrentResult().data).toEqual(current);
    expect(product.getCurrentResult().data).toEqual(current);
    for (const key of ["seller-reviews", "seller-breakdown", "my-seller-review"]) expect(client.getQueryState([key, sellerId])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["public-product-details", "product-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["public-product-details", "product-b"])?.isInvalidated).toBe(false);
    unStore(); unProduct(); client.clear();
  });
}