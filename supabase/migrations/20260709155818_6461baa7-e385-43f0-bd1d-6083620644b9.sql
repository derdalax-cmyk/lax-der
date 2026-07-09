-- ETAPA 5: avaliação multi-dimensão
ALTER TABLE public.seller_reviews
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rating_quality smallint CHECK (rating_quality BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_delivery smallint CHECK (rating_delivery BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_service smallint CHECK (rating_service BETWEEN 1 AND 5);

-- Preenche a nota geral a partir das três dimensões quando fornecidas
CREATE OR REPLACE FUNCTION public.set_review_overall()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.rating_quality IS NOT NULL AND NEW.rating_delivery IS NOT NULL AND NEW.rating_service IS NOT NULL THEN
    NEW.rating := round((NEW.rating_quality + NEW.rating_delivery + NEW.rating_service) / 3.0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_review_overall ON public.seller_reviews;
CREATE TRIGGER trg_set_review_overall
  BEFORE INSERT OR UPDATE ON public.seller_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_review_overall();

-- ETAPA 9: aprovação automática de produtos de vendedores aprovados
CREATE OR REPLACE FUNCTION public.set_product_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
BEGIN
  -- Produtos criados pelo admin (sem vendedor) ficam aprovados
  IF NEW.seller_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT status INTO v_status FROM public.sellers WHERE id = NEW.seller_id;
  IF v_status = 'approved' THEN
    NEW.approval_status := 'approved';
  ELSE
    NEW.approval_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_product_approval ON public.products;
CREATE TRIGGER trg_set_product_approval
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_product_approval();

-- Quando um vendedor é aprovado, aprova automaticamente os seus produtos pendentes
CREATE OR REPLACE FUNCTION public.approve_seller_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.products
       SET approval_status = 'approved', updated_at = now()
     WHERE seller_id = NEW.id AND approval_status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approve_seller_products ON public.sellers;
CREATE TRIGGER trg_approve_seller_products
  AFTER UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.approve_seller_products();

-- ETAPA 8: dashboard de vendedores para o admin
CREATE OR REPLACE FUNCTION public.get_admin_sellers_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  SELECT jsonb_build_object(
    'total_sellers', (SELECT count(*) FROM sellers WHERE status = 'approved'),
    'active_sellers', (
      SELECT count(DISTINCT p.seller_id)
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= now() - interval '30 days' AND p.seller_id IS NOT NULL
    ),
    'new_sellers', (SELECT count(*) FROM sellers WHERE status = 'approved' AND created_at >= now() - interval '30 days'),
    'blocked_sellers', (SELECT count(*) FROM sellers WHERE is_blocked = true),
    'sellers', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT
          s.id, s.store_name, s.logo_url, s.city, s.province, s.status,
          s.rating, s.total_reviews, s.is_blocked,
          (SELECT count(*) FROM products p WHERE p.seller_id = s.id) AS product_count,
          COALESCE((
            SELECT count(DISTINCT o.id)
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            JOIN orders o ON o.id = oi.order_id
            WHERE p.seller_id = s.id
          ), 0) AS order_count,
          COALESCE((
            SELECT sum(oi.price * oi.quantity)
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            JOIN orders o ON o.id = oi.order_id
            WHERE p.seller_id = s.id AND o.status IN ('paid','processing','sent','delivered')
          ), 0) AS revenue
        FROM sellers s
        WHERE s.status = 'approved'
      ) t
    ), '[]'::jsonb),
    'sales_by_city', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT s.city, sum(oi.price * oi.quantity) AS revenue
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        JOIN sellers s ON s.id = p.seller_id
        WHERE o.status IN ('paid','processing','sent','delivered') AND s.city IS NOT NULL
        GROUP BY s.city ORDER BY revenue DESC
      ) t
    ), '[]'::jsonb),
    'activity', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.day) FROM (
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
          COALESCE(count(DISTINCT o.id), 0) AS orders
        FROM generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d(day)
        LEFT JOIN orders o ON date_trunc('day', o.created_at) = d.day
        GROUP BY d.day
      ) t
    ), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END;
$$;

-- RPC para distribuição de estrelas e médias por dimensão de um vendedor
CREATE OR REPLACE FUNCTION public.get_seller_rating_breakdown(_seller_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'avg_quality', COALESCE(round(avg(rating_quality)::numeric, 1), 0),
    'avg_delivery', COALESCE(round(avg(rating_delivery)::numeric, 1), 0),
    'avg_service', COALESCE(round(avg(rating_service)::numeric, 1), 0),
    'distribution', jsonb_build_object(
      '5', count(*) FILTER (WHERE rating = 5),
      '4', count(*) FILTER (WHERE rating = 4),
      '3', count(*) FILTER (WHERE rating = 3),
      '2', count(*) FILTER (WHERE rating = 2),
      '1', count(*) FILTER (WHERE rating = 1)
    )
  )
  FROM public.seller_reviews WHERE seller_id = _seller_id;
$$;