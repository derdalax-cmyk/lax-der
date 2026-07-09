-- 1) Product city derived from seller
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS city text;

UPDATE public.products p
SET city = s.city
FROM public.sellers s
WHERE p.seller_id = s.id AND p.city IS DISTINCT FROM s.city;

CREATE OR REPLACE FUNCTION public.set_product_city()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.seller_id IS NOT NULL THEN
    SELECT city INTO NEW.city FROM public.sellers WHERE id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_product_city ON public.products;
CREATE TRIGGER trg_set_product_city
BEFORE INSERT OR UPDATE OF seller_id ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_product_city();

CREATE OR REPLACE FUNCTION public.propagate_seller_city()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.city IS DISTINCT FROM OLD.city THEN
    UPDATE public.products SET city = NEW.city WHERE seller_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_seller_city ON public.sellers;
CREATE TRIGGER trg_propagate_seller_city
AFTER UPDATE OF city ON public.sellers
FOR EACH ROW EXECUTE FUNCTION public.propagate_seller_city();

-- 2) Seller rating / review / block fields (used by dashboards)
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS rating numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS total_reviews integer NOT NULL DEFAULT 0;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- 3) Cities that currently have available products
CREATE OR REPLACE FUNCTION public.get_available_cities()
RETURNS TABLE(city text, product_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.city, count(*)::bigint
  FROM public.products p
  WHERE p.city IS NOT NULL
    AND p.approval_status = 'approved'
    AND p.status <> 'sold'
  GROUP BY p.city
  ORDER BY count(*) DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_available_cities() TO anon, authenticated;

-- 4) Seller dashboard aggregates (scoped to the calling seller)
CREATE OR REPLACE FUNCTION public.get_seller_dashboard()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seller uuid := public.current_seller_id();
  v jsonb;
BEGIN
  IF v_seller IS NULL THEN
    RETURN jsonb_build_object('error', 'not_seller');
  END IF;

  SELECT jsonb_build_object(
    'month_revenue', COALESCE((
      SELECT sum(oi.price * oi.quantity)
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      JOIN public.orders o ON o.id = oi.order_id
      WHERE p.seller_id = v_seller
        AND o.status IN ('paid','processing','sent','delivered')
        AND o.created_at >= date_trunc('month', now())
    ), 0),
    'month_orders', COALESCE((
      SELECT count(DISTINCT o.id)
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      JOIN public.orders o ON o.id = oi.order_id
      WHERE p.seller_id = v_seller
        AND o.created_at >= date_trunc('month', now())
    ), 0),
    'pending_orders', COALESCE((
      SELECT count(DISTINCT o.id)
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      JOIN public.orders o ON o.id = oi.order_id
      WHERE p.seller_id = v_seller
        AND o.status IN ('pending','paid')
    ), 0),
    'avg_rating', (SELECT rating FROM public.sellers WHERE id = v_seller),
    'total_reviews', (SELECT total_reviews FROM public.sellers WHERE id = v_seller),
    'top_products', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT p.title, sum(oi.quantity)::int AS qty
        FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id
        JOIN public.orders o ON o.id = oi.order_id
        WHERE p.seller_id = v_seller
          AND o.status IN ('paid','processing','sent','delivered')
        GROUP BY p.title ORDER BY qty DESC LIMIT 5
      ) t
    ), '[]'::jsonb),
    'daily', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.day) FROM (
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
          COALESCE(sum(s.price * s.quantity), 0) AS revenue
        FROM generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d(day)
        LEFT JOIN (
          SELECT o.created_at, oi.price, oi.quantity
          FROM public.orders o
          JOIN public.order_items oi ON oi.order_id = o.id
          JOIN public.products p ON p.id = oi.product_id
          WHERE p.seller_id = v_seller
            AND o.status IN ('paid','processing','sent','delivered')
        ) s ON date_trunc('day', s.created_at) = d.day
        GROUP BY d.day
      ) t
    ), '[]'::jsonb),
    'category_sales', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT p.category, sum(oi.price * oi.quantity) AS revenue
        FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id
        JOIN public.orders o ON o.id = oi.order_id
        WHERE p.seller_id = v_seller
          AND o.status IN ('paid','processing','sent','delivered')
        GROUP BY p.category ORDER BY revenue DESC
      ) t
    ), '[]'::jsonb),
    'recent_orders', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT DISTINCT o.id, o.customer_name, o.total, o.status::text AS status, o.created_at
        FROM public.orders o
        JOIN public.order_items oi ON oi.order_id = o.id
        JOIN public.products p ON p.id = oi.product_id
        WHERE p.seller_id = v_seller
        ORDER BY o.created_at DESC LIMIT 5
      ) t
    ), '[]'::jsonb),
    'low_stock', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT p.title, v2.size, v2.color, v2.stock
        FROM public.product_variations v2
        JOIN public.products p ON p.id = v2.product_id
        WHERE p.seller_id = v_seller AND v2.is_active AND v2.stock < 5
        ORDER BY v2.stock ASC LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v;

  RETURN v;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_seller_dashboard() TO authenticated;