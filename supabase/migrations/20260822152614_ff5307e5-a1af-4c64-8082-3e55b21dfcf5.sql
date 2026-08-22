-- 1) product_variations public read
DROP POLICY IF EXISTS "Anyone can view variations" ON public.product_variations;
CREATE POLICY "Public view approved product variations"
ON public.product_variations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variations.product_id
      AND p.approval_status = 'approved'
      AND p.status <> 'sold'
  )
  OR EXISTS (
    SELECT 1 FROM public.products p2
    WHERE p2.id = product_variations.product_id
      AND p2.seller_id IS NOT NULL
      AND p2.seller_id = public.current_seller_id()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- 2) featured_collection_products read
DROP POLICY IF EXISTS "fcp_select_all" ON public.featured_collection_products;
CREATE POLICY "fcp_select_scoped"
ON public.featured_collection_products FOR SELECT
USING (
  status = 'approved'
  OR (seller_id IS NOT NULL AND seller_id = public.current_seller_id())
  OR (submitted_by IS NOT NULL AND submitted_by = public.current_seller_id())
  OR public.has_role(auth.uid(), 'admin')
);

-- 3) seller_reviews require a real purchase
DROP POLICY IF EXISTS "Users create own review" ON public.seller_reviews;
CREATE POLICY "Users create own review after purchase"
ON public.seller_reviews FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND order_id IS NOT NULL
  AND EXISTS (
    SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
     WHERE o.id = seller_reviews.order_id
       AND o.user_id = auth.uid()
       AND o.status <> 'cancelled'
       AND oi.seller_id = seller_reviews.seller_id
  )
);