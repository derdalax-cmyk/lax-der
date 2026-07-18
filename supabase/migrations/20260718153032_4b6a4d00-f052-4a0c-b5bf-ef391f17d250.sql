
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  SELECT jsonb_build_object(
    'gmv_today', COALESCE((
      SELECT sum(total) FROM orders
      WHERE created_at >= date_trunc('day', now())
    ), 0),
    'gmv_yesterday', COALESCE((
      SELECT sum(total) FROM orders
      WHERE created_at >= date_trunc('day', now()) - interval '1 day'
        AND created_at < date_trunc('day', now())
    ), 0),
    'orders_today', COALESCE((
      SELECT count(*) FROM orders
      WHERE created_at >= date_trunc('day', now())
    ), 0),
    'orders_pending', COALESCE((
      SELECT count(*) FROM orders WHERE status = 'pending'
    ), 0),
    'new_signups_today', COALESCE((
      SELECT count(*) FROM profiles
      WHERE created_at >= date_trunc('day', now())
    ), 0),
    'new_sellers_today', COALESCE((
      SELECT count(*) FROM sellers
      WHERE created_at >= date_trunc('day', now())
    ), 0),
    'revenue_last_14_days', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.date) FROM (
        SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
          COALESCE((SELECT sum(total) FROM orders o
            WHERE date_trunc('day', o.created_at) = d.day), 0) AS total
        FROM generate_series(
          date_trunc('day', now()) - interval '13 days',
          date_trunc('day', now()),
          interval '1 day'
        ) d(day)
      ) t
    ), '[]'::jsonb),
    'signups_last_14_days', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.date) FROM (
        SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
          COALESCE((SELECT count(*) FROM profiles p
            WHERE date_trunc('day', p.created_at) = d.day), 0) AS buyers,
          COALESCE((SELECT count(*) FROM sellers s
            WHERE date_trunc('day', s.created_at) = d.day), 0) AS sellers
        FROM generate_series(
          date_trunc('day', now()) - interval '13 days',
          date_trunc('day', now()),
          interval '1 day'
        ) d(day)
      ) t
    ), '[]'::jsonb),
    'top_sellers', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT s.store_name,
          count(DISTINCT oi.order_id)::int AS orders_count,
          COALESCE(sum(oi.price * oi.quantity), 0) AS revenue,
          s.rating
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN sellers s ON s.id = oi.seller_id
        WHERE o.created_at >= now() - interval '7 days'
        GROUP BY s.id, s.store_name, s.rating
        ORDER BY revenue DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb),
    'avg_ticket_7d', COALESCE((
      SELECT CASE WHEN count(*) = 0 THEN 0 ELSE sum(total) / count(*) END
      FROM orders WHERE created_at >= now() - interval '7 days'
    ), 0),
    'sellers_pending_count', COALESCE((
      SELECT count(*) FROM sellers WHERE status = 'pending'
    ), 0)
  ) INTO v;
  RETURN v;
END;
$$;
