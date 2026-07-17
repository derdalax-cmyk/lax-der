ALTER TABLE public.featured_collection_products
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE CASCADE;

UPDATE public.featured_collection_products fcp
SET seller_id = COALESCE(fcp.submitted_by, p.seller_id)
FROM public.products p
WHERE p.id = fcp.product_id
  AND fcp.seller_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_featured_collection_products_seller
  ON public.featured_collection_products(seller_id, collection_id, status);

DROP POLICY IF EXISTS "Sellers submit own products to active collections" ON public.featured_collection_products;
CREATE POLICY "Sellers submit own products to active collections"
ON public.featured_collection_products
FOR INSERT TO authenticated
WITH CHECK (
  seller_id = public.current_seller_id()
  AND submitted_by = public.current_seller_id()
  AND status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = product_id
      AND p.seller_id = public.current_seller_id()
  )
  AND EXISTS (
    SELECT 1
    FROM public.featured_collections c
    WHERE c.id = collection_id
      AND c.is_active = true
      AND NOT (public.current_seller_id() = ANY(c.hidden_sellers))
      AND (c.starts_at IS NULL OR c.starts_at <= now())
      AND (c.ends_at IS NULL OR c.ends_at >= now())
  )
);

DROP POLICY IF EXISTS "Sellers withdraw own pending submissions" ON public.featured_collection_products;
CREATE POLICY "Sellers withdraw own pending submissions"
ON public.featured_collection_products
FOR DELETE TO authenticated
USING (seller_id = public.current_seller_id() AND status <> 'approved');

CREATE OR REPLACE FUNCTION public.submit_products_to_collection(_collection_id uuid, _product_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seller uuid := public.current_seller_id();
  _max int;
  _hidden uuid[];
  _active boolean;
  _starts timestamptz;
  _ends timestamptz;
  _existing int;
  _pid uuid;
BEGIN
  IF _seller IS NULL THEN RAISE EXCEPTION 'Não é vendedor aprovado'; END IF;

  SELECT max_products_per_seller, hidden_sellers, is_active, starts_at, ends_at
    INTO _max, _hidden, _active, _starts, _ends
    FROM featured_collections
   WHERE id = _collection_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Destaque não existe'; END IF;
  IF NOT _active OR (_starts IS NOT NULL AND _starts > now()) OR (_ends IS NOT NULL AND _ends < now()) THEN
    RAISE EXCEPTION 'Destaque indisponível';
  END IF;
  IF _seller = ANY(_hidden) THEN RAISE EXCEPTION 'Sem permissão para este destaque'; END IF;

  SELECT count(*) INTO _existing
    FROM featured_collection_products
   WHERE collection_id = _collection_id
     AND seller_id = _seller
     AND status <> 'rejected';

  FOREACH _pid IN ARRAY _product_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM products
       WHERE id = _pid AND seller_id = _seller
    ) THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM featured_collection_products
       WHERE collection_id = _collection_id AND product_id = _pid
    ) THEN CONTINUE; END IF;

    IF _max > 0 AND _existing >= _max THEN
      RAISE EXCEPTION 'Limite de % produto(s) por vendedor atingido neste destaque', _max;
    END IF;

    INSERT INTO featured_collection_products
      (collection_id, product_id, seller_id, sort_order, status, submitted_by)
    VALUES
      (_collection_id, _pid, _seller, 9999, 'pending', _seller);

    _existing := _existing + 1;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_product_from_collection(_collection_id uuid, _product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _seller uuid := public.current_seller_id();
BEGIN
  IF _seller IS NULL THEN RAISE EXCEPTION 'Não é vendedor aprovado'; END IF;
  DELETE FROM public.featured_collection_products
   WHERE collection_id = _collection_id
     AND product_id = _product_id
     AND seller_id = _seller
     AND status <> 'approved';
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_order_seller_part()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_seller uuid;
BEGIN
  SELECT seller_id INTO v_seller FROM public.products WHERE id = NEW.product_id;
  IF v_seller IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.order_sellers (order_id, seller_id, subtotal)
  VALUES (NEW.order_id, v_seller, NEW.price * NEW.quantity)
  ON CONFLICT (order_id, seller_id)
  DO UPDATE SET
    subtotal = public.order_sellers.subtotal + EXCLUDED.subtotal,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_seller_part ON public.order_items;
CREATE TRIGGER trg_sync_order_seller_part
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.sync_order_seller_part();

INSERT INTO public.order_sellers (order_id, seller_id, subtotal)
SELECT oi.order_id, p.seller_id, sum(oi.price * oi.quantity)
FROM public.order_items oi
JOIN public.products p ON p.id = oi.product_id
WHERE p.seller_id IS NOT NULL
GROUP BY oi.order_id, p.seller_id
ON CONFLICT (order_id, seller_id)
DO UPDATE SET subtotal = EXCLUDED.subtotal, updated_at = now();

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_buyer_id_seller_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_buyer_seller_general_unique
  ON public.conversations(buyer_id, seller_id)
  WHERE order_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_buyer_seller_order_unique
  ON public.conversations(buyer_id, seller_id, order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON public.conversations(order_id);

CREATE OR REPLACE FUNCTION public.start_order_conversation(_order_id uuid, _seller_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_seller_user uuid;
  v_conv uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id AND o.user_id = v_uid
  ) THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id AND p.seller_id = _seller_id
  ) THEN RAISE EXCEPTION 'Loja não pertence a este pedido'; END IF;

  SELECT user_id INTO v_seller_user
  FROM public.sellers
  WHERE id = _seller_id AND status = 'approved';

  IF v_seller_user IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;

  SELECT id INTO v_conv
  FROM public.conversations
  WHERE buyer_id = v_uid
    AND seller_id = _seller_id
    AND order_id = _order_id;

  IF v_conv IS NULL THEN
    INSERT INTO public.conversations (buyer_id, seller_id, seller_user_id, order_id)
    VALUES (v_uid, _seller_id, v_seller_user, _order_id)
    RETURNING id INTO v_conv;
  END IF;

  RETURN v_conv;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_conversations()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'last_message_at') DESC NULLS LAST), '[]'::jsonb) INTO v
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'role', CASE WHEN c.buyer_id = v_uid THEN 'buyer' ELSE 'seller' END,
      'seller_id', c.seller_id,
      'product_id', c.product_id,
      'order_id', c.order_id,
      'last_message', c.last_message,
      'last_message_at', c.last_message_at,
      'unread', CASE WHEN c.buyer_id = v_uid THEN c.buyer_unread ELSE c.seller_unread END,
      'name', CASE WHEN c.buyer_id = v_uid THEN s.store_name ELSE COALESCE(NULLIF(pr.name,''),'Cliente') END,
      'avatar', CASE WHEN c.buyer_id = v_uid THEN s.logo_url ELSE pr.avatar_url END,
      'phone', CASE WHEN c.buyer_id = v_uid THEN s.phone ELSE pr.phone END
    ) AS row
    FROM public.conversations c
    JOIN public.sellers s ON s.id = c.seller_id
    LEFT JOIN public.profiles pr ON pr.id = c.buyer_id
    WHERE c.buyer_id = v_uid OR c.seller_user_id = v_uid
  ) t;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_order_history()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(order_row ORDER BY (order_row->>'created_at') DESC), '[]'::jsonb)
  INTO v
  FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'created_at', o.created_at,
      'status', o.status::text,
      'payment_status', o.payment_status,
      'payment_method', o.payment_method::text,
      'payment_reference', o.payment_reference,
      'subtotal', o.subtotal,
      'shipping', o.shipping,
      'total', o.total,
      'customer_name', o.customer_name,
      'customer_phone', o.customer_phone,
      'shipping_address', o.shipping_address,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'title', p.title,
          'images', p.images,
          'quantity', oi.quantity,
          'price', oi.price,
          'seller_id', p.seller_id
        ) ORDER BY oi.id)
        FROM public.order_items oi
        LEFT JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
      ), '[]'::jsonb),
      'sellers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id,
          'store_name', s.store_name,
          'logo_url', s.logo_url,
          'phone', s.phone,
          'status', COALESCE(os.status, 'pending'),
          'tracking_code', os.tracking_code,
          'notes', os.notes,
          'subtotal', os.subtotal,
          'items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', oi2.id,
              'product_id', oi2.product_id,
              'title', p2.title,
              'quantity', oi2.quantity,
              'price', oi2.price
            ) ORDER BY oi2.id)
            FROM public.order_items oi2
            JOIN public.products p2 ON p2.id = oi2.product_id
            WHERE oi2.order_id = o.id AND p2.seller_id = s.id
          ), '[]'::jsonb)
        ) ORDER BY s.store_name)
        FROM public.order_sellers os
        JOIN public.sellers s ON s.id = os.seller_id
        WHERE os.order_id = o.id
      ), '[]'::jsonb)
    ) AS order_row
    FROM public.orders o
    WHERE o.user_id = v_uid
  ) q;

  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_order_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_order_history() TO authenticated;