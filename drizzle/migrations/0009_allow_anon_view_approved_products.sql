DROP POLICY IF EXISTS "Authenticated view approved products" ON public.products;
CREATE POLICY "Anyone can view approved products"
ON public.products FOR SELECT
TO anon, authenticated
USING (approval_status = 'approved' AND status != 'sold');