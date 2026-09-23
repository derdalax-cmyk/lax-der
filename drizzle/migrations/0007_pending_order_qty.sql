CREATE OR REPLACE FUNCTION public.get_products_pending_orders()
RETURNS TABLE(product_id uuid, pending_qty bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT oi.product_id, sum(oi.quantity)::bigint
  FROM order_items oi
  JOIN order_sellers os ON os.order_id = oi.order_id AND os.seller_id = oi.seller_id
  WHERE os.status IN ('pending','processing','sent')
    AND oi.product_id IS NOT NULL
    AND (public.has_role(auth.uid(), 'admin') OR oi.seller_id = public.current_seller_id())
  GROUP BY oi.product_id
$$;
REVOKE ALL ON FUNCTION public.get_products_pending_orders() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_products_pending_orders() TO authenticated;