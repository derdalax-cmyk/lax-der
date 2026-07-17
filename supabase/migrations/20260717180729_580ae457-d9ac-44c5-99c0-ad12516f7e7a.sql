DROP TRIGGER IF EXISTS trg_sync_order_seller_part ON public.order_items;
DROP TRIGGER IF EXISTS trg_sync_order_seller ON public.order_items;

CREATE OR REPLACE FUNCTION public.sync_order_seller_part()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
BEGIN
  SELECT seller_id INTO v_seller
  FROM public.products
  WHERE id = NEW.product_id;

  IF v_seller IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.order_sellers (order_id, seller_id, subtotal)
  VALUES (NEW.order_id, v_seller, NEW.price * NEW.quantity)
  ON CONFLICT (order_id, seller_id)
  DO UPDATE SET
    subtotal = public.order_sellers.subtotal + EXCLUDED.subtotal,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_order_seller
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.sync_order_seller_part();

UPDATE public.featured_collection_products fcp
SET seller_id = p.seller_id
FROM public.products p
WHERE p.id = fcp.product_id
  AND fcp.seller_id IS NULL
  AND p.seller_id IS NOT NULL;