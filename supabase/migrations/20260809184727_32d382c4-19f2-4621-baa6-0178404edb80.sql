DROP POLICY IF EXISTS "Sellers create own products" ON public.products;
CREATE POLICY "Sellers create own products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (
  seller_id IS NOT NULL
  AND seller_id = current_seller_id()
);

DROP POLICY IF EXISTS "Sellers update own products" ON public.products;
CREATE POLICY "Sellers update own products"
ON public.products FOR UPDATE TO authenticated
USING (seller_id = current_seller_id())
WITH CHECK (seller_id = current_seller_id());