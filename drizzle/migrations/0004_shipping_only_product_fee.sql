CREATE OR REPLACE FUNCTION public.recalc_order_totals(_order_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
BEGIN
  SELECT COALESCE(sum(oi.price * oi.quantity), 0) INTO v_subtotal
    FROM public.order_items oi WHERE oi.order_id = _order_id;

  SELECT COALESCE(sum(fee), 0) INTO v_shipping FROM (
    SELECT DISTINCT p.id, p.shipping_fee AS fee
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = _order_id AND COALESCE(p.shipping_fee, 0) > 0
  ) q;

  UPDATE public.orders
     SET subtotal = v_subtotal, shipping = v_shipping,
         total = v_subtotal + v_shipping, updated_at = now()
   WHERE id = _order_id;

  UPDATE public.order_sellers os
     SET subtotal = COALESCE((
           SELECT sum(oi.price * oi.quantity) FROM public.order_items oi
            WHERE oi.order_id = _order_id AND oi.seller_id = os.seller_id), 0),
         updated_at = now()
   WHERE os.order_id = _order_id;
END;
$function$;