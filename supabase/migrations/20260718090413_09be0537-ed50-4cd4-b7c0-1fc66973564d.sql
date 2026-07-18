
-- 1) Auto-approve new sellers so they can list and receive orders immediately
CREATE OR REPLACE FUNCTION public.auto_approve_seller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status = 'pending' THEN
    NEW.status := 'approved';
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_approve_seller ON public.sellers;
CREATE TRIGGER trg_auto_approve_seller
  BEFORE INSERT ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.auto_approve_seller();

-- Approve any pending sellers that already exist
UPDATE public.sellers SET status = 'approved', approved_at = COALESCE(approved_at, now())
 WHERE status = 'pending';

-- 2) Relax product INSERT/UPDATE policies: any seller row owned by the user (approved or not) can manage own products
DROP POLICY IF EXISTS "Sellers create own products" ON public.products;
CREATE POLICY "Sellers create own products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    seller_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = products.seller_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Sellers update own products" ON public.products;
CREATE POLICY "Sellers update own products" ON public.products
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = products.seller_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = products.seller_id AND s.user_id = auth.uid()));

-- 3) Include full customer data (shipping address, totals, notes) in seller orders RPC
CREATE OR REPLACE FUNCTION public.get_seller_orders()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seller uuid := public.current_seller_id();
  v jsonb;
BEGIN
  IF v_seller IS NULL THEN
    RETURN jsonb_build_object('error', 'not_seller');
  END IF;

  SELECT jsonb_build_object(
    'orders', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.created_at DESC) FROM (
        SELECT
          o.id,
          o.customer_name,
          o.customer_phone,
          o.city,
          o.shipping_address,
          o.notes,
          o.subtotal,
          o.shipping,
          o.total,
          o.payment_reference,
          o.status::text AS status,
          o.payment_status::text AS payment_status,
          o.payment_method,
          o.created_at,
          sub.seller_total,
          sub.items,
          COALESCE(os.status, 'pending') AS seller_status,
          os.tracking_code,
          os.notes AS seller_notes
        FROM public.orders o
        JOIN LATERAL (
          SELECT
            sum(oi.price * oi.quantity) AS seller_total,
            jsonb_agg(jsonb_build_object(
              'title', p.title,
              'quantity', oi.quantity,
              'price', oi.price,
              'size', oi.size,
              'color', oi.color,
              'images', p.images
            )) AS items
          FROM public.order_items oi
          JOIN public.products p ON p.id = oi.product_id
          WHERE oi.order_id = o.id AND p.seller_id = v_seller
        ) sub ON true
        LEFT JOIN public.order_sellers os ON os.order_id = o.id AND os.seller_id = v_seller
        WHERE EXISTS (
          SELECT 1 FROM public.order_items oi2
          JOIN public.products p2 ON p2.id = oi2.product_id
          WHERE oi2.order_id = o.id AND p2.seller_id = v_seller
        )
      ) t
    ), '[]'::jsonb),
    'stats', (
      SELECT jsonb_build_object(
        'total_orders', COALESCE(count(DISTINCT o.id), 0),
        'revenue', COALESCE(sum(oi.price * oi.quantity), 0),
        'pending', COALESCE(count(DISTINCT o.id) FILTER (WHERE COALESCE(os.status,'pending') IN ('pending','processing')), 0)
      )
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      JOIN public.products p ON p.id = oi.product_id
      LEFT JOIN public.order_sellers os ON os.order_id = o.id AND os.seller_id = v_seller
      WHERE p.seller_id = v_seller
    )
  ) INTO v;

  RETURN v;
END;
$$;

-- 4) Backfill order_sellers for any existing orders that were placed before the sync trigger existed
INSERT INTO public.order_sellers (order_id, seller_id, subtotal)
SELECT oi.order_id, p.seller_id, sum(oi.price * oi.quantity)
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
 WHERE p.seller_id IS NOT NULL
 GROUP BY oi.order_id, p.seller_id
ON CONFLICT (order_id, seller_id) DO NOTHING;
