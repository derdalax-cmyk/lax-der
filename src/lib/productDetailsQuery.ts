import { queryOptions } from "@tanstack/react-query";
import { getPublicProductDetails } from "./productDetails.functions";

/** One shared key for deliberate card prefetch and the existing detail loader. */
export const productDetailsQuery = (id: string) => queryOptions({
  queryKey: ["public-product-details", id],
  queryFn: () => getPublicProductDetails({ data: { id } }),
  staleTime: 60_000,
});