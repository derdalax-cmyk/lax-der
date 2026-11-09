import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { recommendationSections, type PublicProduct } from "@/lib/productDetails";
import type { ProductCardData } from "@/components/ProductCard";

function normalizedImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.flatMap(image => {
    const url = typeof image === "string" ? image : image && typeof image === "object" && "url" in image ? image.url : null;
    return typeof url === "string" ? [url] : [];
  });
}

export const getPublicProductDetails = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("public_product_configuration_missing");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_")) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { data: product, error } = await client.from("public_products")
      .select("id,title,description,base_price,original_price,shipping_fee,category,images,is_unique,status,reserved_until,seller_id,city")
      .eq("id", data.id).maybeSingle();
    if (error) throw new Error("public_product_unavailable");
    if (!product) return { product: null, related: [], sellerProducts: [] };
    const fields = "id,title,base_price,original_price,images,is_unique,status,category";
    const available = () => client.from("public_products").select(fields).eq("approval_status", "approved")
      .eq("status", "available").neq("id", data.id)
      .order("created_at", { ascending: false }).order("id", { ascending: false });
    const [categoryRows, sellerRows] = await Promise.all([
      product.category ? available().eq("category", product.category).limit(30) : Promise.resolve({ data: [] }),
      product.seller_id ? available().eq("seller_id", product.seller_id).limit(50) : Promise.resolve({ data: [] }),
    ]);
    const normalize = (row: ProductCardData) => ({ ...row, images: normalizedImages(row.images) });
    return { product: { ...product, images: normalizedImages(product.images) } as PublicProduct, ...recommendationSections(data.id, ((categoryRows.data ?? []) as ProductCardData[]).map(normalize), ((sellerRows.data ?? []) as ProductCardData[]).map(normalize)) };
  });