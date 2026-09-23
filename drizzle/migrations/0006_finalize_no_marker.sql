CREATE OR REPLACE FUNCTION public.finalize_order_items(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_owner uuid; r RECORD;
BEGIN
  SELECT user_id INTO v_owner FROM orders WHERE id = _order_id;
  IF v_owner IS NULL OR (v_owner <> v_uid AND NOT has_role(v_uid, 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
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
END; $$;
UPDATE public.orders SET notes = NULLIF(trim(replace(notes, '[stock_held]', '')), '') WHERE notes LIKE '%[stock_held]%';