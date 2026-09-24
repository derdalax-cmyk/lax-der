DROP POLICY IF EXISTS "Anyone can view approved products" ON public.products;
CREATE POLICY "Authenticated view approved products" ON public.products
  FOR SELECT TO authenticated USING (approval_status = 'approved');

DROP POLICY IF EXISTS "Public view approved product variations" ON public.product_variations;
CREATE POLICY "Authenticated view approved product variations" ON public.product_variations
  FOR SELECT TO authenticated USING (
    (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variations.product_id AND p.approval_status = 'approved' AND p.status <> 'sold'::product_status))
    OR (EXISTS (SELECT 1 FROM public.products p2 WHERE p2.id = product_variations.product_id AND p2.seller_id IS NOT NULL AND p2.seller_id = current_seller_id()))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.product_variations FROM anon;