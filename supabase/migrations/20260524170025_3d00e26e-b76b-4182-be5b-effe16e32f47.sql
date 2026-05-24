
-- 1. Remove nr_documento
ALTER TABLE public.profiles DROP COLUMN IF EXISTS nr_documento;

-- 2. cart_items
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  variation_id uuid,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id, variation_id)
);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cart" ON public.cart_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER cart_items_updated_at BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cart_user ON public.cart_items(user_id);

-- 3. RPC reserve_product (peça única)
CREATE OR REPLACE FUNCTION public.reserve_product(_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_product products%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_product FROM products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT v_product.is_unique THEN
    RETURN jsonb_build_object('ok', true, 'reserved', false);
  END IF;

  IF v_product.status = 'available'
     OR (v_product.status = 'reserved' AND v_product.reserved_by = v_uid)
     OR (v_product.status = 'reserved' AND v_product.reserved_until < now()) THEN
    UPDATE products
       SET status = 'reserved',
           reserved_by = v_uid,
           reserved_until = now() + interval '15 minutes',
           updated_at = now()
     WHERE id = _product_id;
    RETURN jsonb_build_object('ok', true, 'reserved', true, 'until', (now() + interval '15 minutes'));
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'unavailable');
END;
$$;

-- 4. RPC release_product (remover do carrinho de peça única libera reserva)
CREATE OR REPLACE FUNCTION public.release_product(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  UPDATE products
     SET status = 'available', reserved_by = NULL, reserved_until = NULL, updated_at = now()
   WHERE id = _product_id AND is_unique AND reserved_by = v_uid AND status = 'reserved';
END;
$$;

-- 5. RPC promote_next_in_queue
CREATE OR REPLACE FUNCTION public.promote_next_in_queue(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_next waiting_list%ROWTYPE;
BEGIN
  SELECT * INTO v_next FROM waiting_list
    WHERE product_id = _product_id AND status = 'waiting'
    ORDER BY position ASC, created_at ASC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE waiting_list
     SET status = 'notified', notified_at = now(), reserved_until = now() + interval '10 minutes'
   WHERE id = v_next.id;
  UPDATE products
     SET status = 'reserved', reserved_by = v_next.user_id, reserved_until = now() + interval '10 minutes', updated_at = now()
   WHERE id = _product_id;
END;
$$;

-- 6. release_expired_reservations (chamado pelo cron)
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_pid uuid;
BEGIN
  -- Marcar como expirados os notificados que não reservaram
  UPDATE waiting_list SET status = 'expired'
   WHERE status = 'notified' AND reserved_until < now();

  FOR v_pid IN
    SELECT id FROM products
     WHERE is_unique AND status = 'reserved' AND reserved_until < now()
  LOOP
    UPDATE products SET status = 'available', reserved_by = NULL, reserved_until = NULL, updated_at = now()
     WHERE id = v_pid;
    -- Remover do carrinho de quem expirou
    DELETE FROM cart_items WHERE product_id = v_pid;
    PERFORM public.promote_next_in_queue(v_pid);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 7. Extensões e cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
