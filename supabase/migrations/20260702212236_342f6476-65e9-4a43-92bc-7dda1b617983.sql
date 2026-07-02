-- Link products to sellers and add approval workflow
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_approval_status_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_approval_status_check CHECK (approval_status IN ('pending','approved','rejected'));

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_approval_status ON public.products(approval_status);

-- Helper: returns the approved seller id owned by the current user (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.current_seller_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.sellers
   WHERE user_id = auth.uid() AND status = 'approved'
   LIMIT 1
$$;

-- Public should only see approved products
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Anyone can view approved products"
  ON public.products FOR SELECT
  USING (approval_status = 'approved');

-- Sellers view their own products (any status)
DROP POLICY IF EXISTS "Sellers view own products" ON public.products;
CREATE POLICY "Sellers view own products"
  ON public.products FOR SELECT
  TO authenticated
  USING (seller_id IS NOT NULL AND seller_id = public.current_seller_id());

-- Sellers create their own products (forced pending, must belong to them)
DROP POLICY IF EXISTS "Sellers create own products" ON public.products;
CREATE POLICY "Sellers create own products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = public.current_seller_id() AND approval_status = 'pending');

-- Sellers update their own products (edits go back to pending review)
DROP POLICY IF EXISTS "Sellers update own products" ON public.products;
CREATE POLICY "Sellers update own products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (seller_id = public.current_seller_id())
  WITH CHECK (seller_id = public.current_seller_id() AND approval_status = 'pending');

-- Sellers delete their own products
DROP POLICY IF EXISTS "Sellers delete own products" ON public.products;
CREATE POLICY "Sellers delete own products"
  ON public.products FOR DELETE
  TO authenticated
  USING (seller_id = public.current_seller_id());

-- Variations: sellers manage variations of their own products
DROP POLICY IF EXISTS "Sellers manage own variations" ON public.product_variations;
CREATE POLICY "Sellers manage own variations"
  ON public.product_variations FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variations.product_id AND p.seller_id = public.current_seller_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variations.product_id AND p.seller_id = public.current_seller_id()));