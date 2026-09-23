-- 1) At checkout: unique pieces become "pending" (reserved, no expiry); stock units are held
CREATE OR REPLACE FUNCTION public.finalize_order_items(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  r RECORD;
BEGIN
  SELECT user_id INTO v_owner FROM orders WHERE id = _order_id;
  IF v_owner IS NULL OR (v_owner <> v_uid AND NOT has_role(v_uid, 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  -- idempotent: only run once per order
  IF EXISTS (SELECT 1 FROM orders WHERE id = _order_id AND notes LIKE '%[stock_held]%') THEN RETURN; END IF;

  FOR r IN
    SELECT oi.product_id, p.is_unique, oi.variation_id, oi.quantity
      FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = _order_id
  LOOP
    IF r.is_unique THEN
      UPDATE products SET status = 'reserved', reserved_by = v_owner, reserved_until = NULL, updated_at = now()
       WHERE id = r.product_id;
      DELETE FROM cart_items WHERE product_id = r.product_id;
    ELSIF r.variation_id IS NOT NULL THEN
      UPDATE product_variations SET stock = GREATEST(0, stock - r.quantity) WHERE id = r.variation_id;
    ELSE
      UPDATE products SET stock = GREATEST(0, stock - r.quantity) WHERE id = r.product_id;
    END IF;
  END LOOP;
  UPDATE orders SET notes = COALESCE(notes || ' ', '') || '[stock_held]' WHERE id = _order_id;
END; $$;

-- 2) React to seller-side status: delivered => sold; cancelled => available / stock restored
CREATE OR REPLACE FUNCTION public.apply_order_seller_product_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r RECORD; v_buyer uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT user_id INTO v_buyer FROM orders WHERE id = NEW.order_id;

  FOR r IN
    SELECT oi.product_id, p.is_unique, oi.variation_id, oi.quantity
      FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = NEW.order_id AND oi.seller_id = NEW.seller_id
  LOOP
    IF NEW.status = 'cancelled' THEN
      IF r.is_unique THEN
        UPDATE products SET status = 'available', reserved_by = NULL, reserved_until = NULL, updated_at = now()
         WHERE id = r.product_id AND status IN ('reserved','sold');
        PERFORM public.promote_next_in_queue(r.product_id);
      ELSIF r.variation_id IS NOT NULL THEN
        UPDATE product_variations SET stock = stock + r.quantity WHERE id = r.variation_id;
      ELSE
        UPDATE products SET stock = stock + r.quantity WHERE id = r.product_id;
      END IF;
    ELSE
      -- leaving "cancelled" re-holds the stock
      IF OLD.status = 'cancelled' THEN
        IF r.is_unique THEN
          UPDATE products SET status = 'reserved', reserved_by = v_buyer, reserved_until = NULL, updated_at = now()
           WHERE id = r.product_id;
        ELSIF r.variation_id IS NOT NULL THEN
          UPDATE product_variations SET stock = GREATEST(0, stock - r.quantity) WHERE id = r.variation_id;
        ELSE
          UPDATE products SET stock = GREATEST(0, stock - r.quantity) WHERE id = r.product_id;
        END IF;
      END IF;
      IF r.is_unique THEN
        IF NEW.status = 'delivered' THEN
          UPDATE products SET status = 'sold', reserved_by = NULL, reserved_until = NULL, updated_at = now() WHERE id = r.product_id;
          DELETE FROM cart_items WHERE product_id = r.product_id;
          UPDATE waiting_list SET status = 'expired' WHERE product_id = r.product_id AND status IN ('waiting','notified');
        ELSIF OLD.status = 'delivered' THEN
          UPDATE products SET status = 'reserved', reserved_by = v_buyer, reserved_until = NULL, updated_at = now() WHERE id = r.product_id;
        END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_apply_order_seller_product_state ON public.order_sellers;
CREATE TRIGGER trg_apply_order_seller_product_state
AFTER UPDATE OF status ON public.order_sellers
FOR EACH ROW EXECUTE FUNCTION public.apply_order_seller_product_state();

-- 3) Seller stats: revenue only from confirmed (delivered) sales
CREATE OR REPLACE FUNCTION public.get_seller_orders()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_seller uuid := public.current_seller_id();
  v jsonb;
BEGIN
  IF v_seller IS NULL THEN RETURN jsonb_build_object('error', 'not_seller'); END IF;
  SELECT jsonb_build_object(
    'orders', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.created_at DESC) FROM (
        SELECT o.id, o.customer_name, o.customer_phone,
          (o.shipping_address->>'city') AS city, o.shipping_address, o.notes,
          o.subtotal, o.shipping, o.total, o.payment_reference,
          o.status::text AS status, o.payment_status::text AS payment_status,
          o.payment_method, o.created_at, sub.seller_total, sub.items,
          COALESCE(os.status, 'pending') AS seller_status, os.tracking_code, os.notes AS seller_notes
        FROM public.orders o
        JOIN LATERAL (
          SELECT sum(oi.price * oi.quantity) AS seller_total,
            jsonb_agg(jsonb_build_object(
              'title', COALESCE(p.title, oi.title_snapshot, 'Produto'),
              'quantity', oi.quantity, 'price', oi.price, 'size', pv.size, 'color', pv.color,
              'images', COALESCE(p.images, jsonb_build_array(oi.image_snapshot)))) AS items
          FROM public.order_items oi
          LEFT JOIN public.products p ON p.id = oi.product_id
          LEFT JOIN public.product_variations pv ON pv.id = oi.variation_id
          WHERE oi.order_id = o.id AND oi.seller_id = v_seller
        ) sub ON true
        LEFT JOIN public.order_sellers os ON os.order_id = o.id AND os.seller_id = v_seller
        WHERE EXISTS (SELECT 1 FROM public.order_items oi2 WHERE oi2.order_id = o.id AND oi2.seller_id = v_seller)
      ) t
    ), '[]'::jsonb),
    'stats', (
      SELECT jsonb_build_object(
        'total_orders', COALESCE(count(DISTINCT o.id), 0),
        'revenue', COALESCE(sum(oi.price * oi.quantity) FILTER (WHERE os.status = 'delivered'), 0),
        'pending', COALESCE(count(DISTINCT o.id) FILTER (WHERE COALESCE(os.status,'pending') IN ('pending','processing','sent')), 0)
      )
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      LEFT JOIN public.order_sellers os ON os.order_id = o.id AND os.seller_id = v_seller
      WHERE oi.seller_id = v_seller
    )
  ) INTO v;
  RETURN v;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_seller_dashboard()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_seller uuid := public.current_seller_id(); v jsonb;
BEGIN
  IF v_seller IS NULL THEN RETURN jsonb_build_object('error', 'not_seller'); END IF;
  SELECT jsonb_build_object(
    'month_revenue', COALESCE((
      SELECT sum(oi.price * oi.quantity) FROM order_items oi
      JOIN order_sellers os ON os.order_id = oi.order_id AND os.seller_id = oi.seller_id
      WHERE oi.seller_id = v_seller AND os.status = 'delivered'
        AND os.updated_at >= date_trunc('month', now())), 0),
    'month_orders', COALESCE((
      SELECT count(*) FROM order_sellers os
      WHERE os.seller_id = v_seller AND os.status <> 'cancelled'
        AND os.created_at >= date_trunc('month', now())), 0),
    'pending_orders', COALESCE((
      SELECT count(*) FROM order_sellers os
      WHERE os.seller_id = v_seller AND os.status IN ('pending','processing','sent')), 0),
    'avg_rating', (SELECT rating FROM sellers WHERE id = v_seller),
    'total_reviews', (SELECT total_reviews FROM sellers WHERE id = v_seller),
    'top_products', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT COALESCE(p.title, oi.title_snapshot) AS title, sum(oi.quantity)::int AS qty
        FROM order_items oi
        JOIN order_sellers os ON os.order_id = oi.order_id AND os.seller_id = oi.seller_id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.seller_id = v_seller AND os.status = 'delivered'
        GROUP BY 1 ORDER BY qty DESC LIMIT 5) t), '[]'::jsonb),
    'daily', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.day) FROM (
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COALESCE(sum(s.price * s.quantity), 0) AS revenue
        FROM generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d(day)
        LEFT JOIN (
          SELECT os.updated_at AS at, oi.price, oi.quantity
          FROM order_items oi
          JOIN order_sellers os ON os.order_id = oi.order_id AND os.seller_id = oi.seller_id
          WHERE oi.seller_id = v_seller AND os.status = 'delivered'
        ) s ON date_trunc('day', s.at) = d.day
        GROUP BY d.day) t), '[]'::jsonb),
    'category_sales', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT p.category, sum(oi.price * oi.quantity) AS revenue
        FROM order_items oi
        JOIN order_sellers os ON os.order_id = oi.order_id AND os.seller_id = oi.seller_id
        JOIN products p ON p.id = oi.product_id
        WHERE oi.seller_id = v_seller AND os.status = 'delivered'
        GROUP BY p.category ORDER BY revenue DESC) t), '[]'::jsonb),
    'recent_orders', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT o.id, o.customer_name, os.subtotal AS total, os.status AS status, o.created_at
        FROM order_sellers os JOIN orders o ON o.id = os.order_id
        WHERE os.seller_id = v_seller
        ORDER BY o.created_at DESC LIMIT 5) t), '[]'::jsonb),
    'low_stock', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT p.title, v2.size, v2.color, v2.stock
        FROM product_variations v2 JOIN products p ON p.id = v2.product_id
        WHERE p.seller_id = v_seller AND v2.is_active AND v2.stock < 5
        ORDER BY v2.stock ASC LIMIT 10) t), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END; $function$;

-- 4) Admin top sellers: only confirmed sales
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  SELECT jsonb_build_object(
    'gmv_today', COALESCE((SELECT sum(total) FROM orders WHERE status <> 'cancelled' AND created_at >= date_trunc('day', now())), 0),
    'gmv_yesterday', COALESCE((SELECT sum(total) FROM orders WHERE status <> 'cancelled' AND created_at >= date_trunc('day', now()) - interval '1 day' AND created_at < date_trunc('day', now())), 0),
    'orders_today', COALESCE((SELECT count(*) FROM orders WHERE created_at >= date_trunc('day', now())), 0),
    'orders_pending', COALESCE((SELECT count(DISTINCT order_id) FROM order_sellers WHERE status IN ('pending','processing','sent')), 0),
    'new_signups_today', COALESCE((SELECT count(*) FROM profiles WHERE created_at >= date_trunc('day', now())), 0),
    'new_sellers_today', COALESCE((SELECT count(*) FROM sellers WHERE created_at >= date_trunc('day', now())), 0),
    'revenue_last_14_days', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.date) FROM (
        SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
          COALESCE((SELECT sum(oi.price * oi.quantity) FROM order_items oi
            JOIN order_sellers os ON os.order_id = oi.order_id AND os.seller_id = oi.seller_id
            WHERE os.status = 'delivered' AND date_trunc('day', os.updated_at) = d.day), 0) AS total
        FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d(day)) t), '[]'::jsonb),
    'signups_last_14_days', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.date) FROM (
        SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
          COALESCE((SELECT count(*) FROM profiles p WHERE date_trunc('day', p.created_at) = d.day), 0) AS buyers,
          COALESCE((SELECT count(*) FROM sellers s WHERE date_trunc('day', s.created_at) = d.day), 0) AS sellers
        FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d(day)) t), '[]'::jsonb),
    'top_sellers', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT s.store_name, count(DISTINCT oi.order_id)::int AS orders_count,
          COALESCE(sum(oi.price * oi.quantity), 0) AS revenue, s.rating
        FROM order_items oi
        JOIN order_sellers os ON os.order_id = oi.order_id AND os.seller_id = oi.seller_id
        JOIN sellers s ON s.id = oi.seller_id
        WHERE os.status = 'delivered' AND os.updated_at >= now() - interval '7 days'
        GROUP BY s.id, s.store_name, s.rating ORDER BY revenue DESC LIMIT 5) t), '[]'::jsonb),
    'avg_ticket_7d', COALESCE((
      SELECT CASE WHEN count(*) = 0 THEN 0 ELSE sum(total) / count(*) END
      FROM orders WHERE status <> 'cancelled' AND created_at >= now() - interval '7 days'), 0),
    'sellers_pending_count', COALESCE((SELECT count(*) FROM sellers WHERE status = 'pending'), 0)
  ) INTO v;
  RETURN v;
END; $function$;