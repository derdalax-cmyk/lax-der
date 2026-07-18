
-- Orders: drop admin visibility/edit
DROP POLICY IF EXISTS "Admins view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins update orders" ON public.orders;

-- Order items: drop admin visibility
DROP POLICY IF EXISTS "Admins view all order items" ON public.order_items;

-- Order sellers: drop admin blanket access; keep seller-scoped policies
DROP POLICY IF EXISTS "Admin manages order parts" ON public.order_sellers;

-- Recreate seller policies without admin bypass
DROP POLICY IF EXISTS "Seller can view own order parts" ON public.order_sellers;
DROP POLICY IF EXISTS "Seller can update own order parts" ON public.order_sellers;

CREATE POLICY "Seller can view own order parts"
  ON public.order_sellers FOR SELECT
  TO authenticated
  USING (seller_id = public.current_seller_id());

CREATE POLICY "Seller can update own order parts"
  ON public.order_sellers FOR UPDATE
  TO authenticated
  USING (seller_id = public.current_seller_id())
  WITH CHECK (seller_id = public.current_seller_id());
