
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
          o.id,
          o.customer_name,
          o.customer_phone,
          o.city,
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
              'color', oi.color
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
$function$;
