
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title_snapshot text,
  ADD COLUMN IF NOT EXISTS image_snapshot text;

-- Backfill onde ainda temos product_id
UPDATE public.order_items oi
   SET seller_id = p.seller_id,
       title_snapshot = COALESCE(oi.title_snapshot, p.title),
       image_snapshot = COALESCE(oi.image_snapshot, (p.images->>0))
  FROM public.products p
 WHERE oi.product_id = p.id
   AND (oi.seller_id IS NULL OR oi.title_snapshot IS NULL);

CREATE INDEX IF NOT EXISTS idx_order_items_seller ON public.order_items(seller_id);

-- Trigger de sync passa a usar NEW.seller_id (preenche a partir do produto se vier nulo)
CREATE OR REPLACE FUNCTION public.sync_order_seller_part()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_seller uuid;
  v_title text;
  v_image text;
BEGIN
  IF NEW.seller_id IS NULL AND NEW.product_id IS NOT NULL THEN
    SELECT seller_id, title, (images->>0)
      INTO v_seller, v_title, v_image
      FROM public.products WHERE id = NEW.product_id;
    NEW.seller_id := COALESCE(NEW.seller_id, v_seller);
    NEW.title_snapshot := COALESCE(NEW.title_snapshot, v_title);
    NEW.image_snapshot := COALESCE(NEW.image_snapshot, v_image);
  END IF;

  IF NEW.seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.order_sellers (order_id, seller_id, subtotal)
  VALUES (NEW.order_id, NEW.seller_id, NEW.price * NEW.quantity)
  ON CONFLICT (order_id, seller_id)
  DO UPDATE SET
    subtotal = public.order_sellers.subtotal + EXCLUDED.subtotal,
    updated_at = now();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_order_seller ON public.order_items;
CREATE TRIGGER trg_sync_order_seller
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_seller_part();

-- Política do vendedor pode ler os próprios itens via seller_id direto
DROP POLICY IF EXISTS "Sellers view own order items" ON public.order_items;
CREATE POLICY "Sellers view own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    seller_id = public.current_seller_id()
    OR EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    )
  );

-- RPC de pedidos do vendedor: usar oi.seller_id (com fallback para produto)
CREATE OR REPLACE FUNCTION public.get_seller_orders()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
          o.id, o.customer_name, o.customer_phone, o.city, o.shipping_address, o.notes,
          o.subtotal, o.shipping, o.total, o.payment_reference,
          o.status::text AS status, o.payment_status::text AS payment_status,
          o.payment_method, o.created_at,
          sub.seller_total, sub.items,
          COALESCE(os.status, 'pending') AS seller_status,
          os.tracking_code, os.notes AS seller_notes
        FROM public.orders o
        JOIN LATERAL (
          SELECT
            sum(oi.price * oi.quantity) AS seller_total,
            jsonb_agg(jsonb_build_object(
              'title', COALESCE(p.title, oi.title_snapshot, 'Produto'),
              'quantity', oi.quantity,
              'price', oi.price,
              'size', oi.size,
              'color', oi.color,
              'images', COALESCE(p.images, jsonb_build_array(oi.image_snapshot))
            )) AS items
          FROM public.order_items oi
          LEFT JOIN public.products p ON p.id = oi.product_id
          WHERE oi.order_id = o.id AND oi.seller_id = v_seller
        ) sub ON true
        LEFT JOIN public.order_sellers os ON os.order_id = o.id AND os.seller_id = v_seller
        WHERE EXISTS (
          SELECT 1 FROM public.order_items oi2
          WHERE oi2.order_id = o.id AND oi2.seller_id = v_seller
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
      LEFT JOIN public.order_sellers os ON os.order_id = o.id AND os.seller_id = v_seller
      WHERE oi.seller_id = v_seller
    )
  ) INTO v;

  RETURN v;
END;
$function$;
