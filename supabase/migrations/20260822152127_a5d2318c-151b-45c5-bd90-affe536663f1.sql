-- 1) Server-side price enforcement + seller row creation
CREATE OR REPLACE FUNCTION public.sync_order_seller_part()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seller uuid;
  v_title text;
  v_image text;
  v_base numeric;
  v_var numeric;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT seller_id, title, (images->>0), base_price
      INTO v_seller, v_title, v_image, v_base
      FROM public.products WHERE id = NEW.product_id;
    NEW.seller_id := COALESCE(NEW.seller_id, v_seller);
    NEW.title_snapshot := COALESCE(NEW.title_snapshot, v_title);
    NEW.image_snapshot := COALESCE(NEW.image_snapshot, v_image);
  END IF;

  -- Always overwrite client-supplied price with the real server-side price
  IF NEW.variation_id IS NOT NULL THEN
    SELECT price INTO v_var FROM public.product_variations WHERE id = NEW.variation_id;
  END IF;
  IF COALESCE(v_var, v_base) IS NOT NULL THEN
    NEW.price := COALESCE(v_var, v_base);
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
$$;

-- 2) Recalculate order totals, shipping and per-seller subtotals from real data
CREATE OR REPLACE FUNCTION public.recalc_order_totals(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_fees numeric := 0;
BEGIN
  SELECT COALESCE(sum(oi.price * oi.quantity), 0) INTO v_subtotal
    FROM public.order_items oi WHERE oi.order_id = _order_id;

  IF v_subtotal > 0 AND v_subtotal < 2500 THEN
    SELECT COALESCE(sum(fee), 0) INTO v_fees FROM (
      SELECT DISTINCT p.id, p.shipping_fee AS fee
        FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id
       WHERE oi.order_id = _order_id AND COALESCE(p.shipping_fee, 0) > 0
    ) q;
    v_shipping := CASE WHEN v_fees > 0 THEN v_fees ELSE 100 END;
  END IF;

  UPDATE public.orders
     SET subtotal = v_subtotal,
         shipping = v_shipping,
         total = v_subtotal + v_shipping,
         updated_at = now()
   WHERE id = _order_id;

  UPDATE public.order_sellers os
     SET subtotal = COALESCE((
           SELECT sum(oi.price * oi.quantity)
             FROM public.order_items oi
            WHERE oi.order_id = _order_id AND oi.seller_id = os.seller_id
         ), 0),
         updated_at = now()
   WHERE os.order_id = _order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_order_totals(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalc_order_totals(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_recalc_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recalc_order_totals(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_recalc ON public.order_items;
CREATE TRIGGER trg_order_items_recalc
AFTER INSERT OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_order_totals();