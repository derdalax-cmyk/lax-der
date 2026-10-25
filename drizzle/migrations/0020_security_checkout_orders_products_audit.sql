-- 1) Marcador de finalização de stock (idempotência)
ALTER TABLE public.orders ADD COLUMN stock_finalized_at timestamptz NULL;

-- 2) Criação de pedido 100% no servidor: preços, stock, estado e vendedor lidos da base de dados
CREATE OR REPLACE FUNCTION public.create_order_secure(
  _items jsonb,
  _customer_name text,
  _customer_phone text,
  _shipping_address jsonb,
  _payment_method text,
  _payment_phone text DEFAULT NULL,
  _payment_reference text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_pid uuid;
  v_vid uuid;
  v_qty int;
  v_p public.products%ROWTYPE;
  v_var public.product_variations%ROWTYPE;
  v_price numeric;
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_order_id uuid;
  v_lines jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}';
  v_key text;
  v_seen_keys text[] := '{}';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array'
     OR jsonb_array_length(_items) < 1 OR jsonb_array_length(_items) > 20 THEN
    RAISE EXCEPTION 'Carrinho inválido';
  END IF;
  IF _payment_method NOT IN ('e-mpesa','e-mola','entrega') THEN
    RAISE EXCEPTION 'Método de pagamento inválido';
  END IF;

  -- Validar tudo contra a base de dados, com lock, antes de criar o pedido
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF COALESCE(v_item->>'product_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      RAISE EXCEPTION 'Produto inválido';
    END IF;
    v_pid := (v_item->>'product_id')::uuid;
    v_vid := CASE WHEN COALESCE(v_item->>'variation_id','') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                  THEN (v_item->>'variation_id')::uuid ELSE NULL END;
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty < 1 OR v_qty > 10 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

    v_key := v_pid::text || '/' || COALESCE(v_vid::text, '');
    IF v_key = ANY(v_seen_keys) THEN RAISE EXCEPTION 'Item duplicado no carrinho'; END IF;
    v_seen_keys := v_seen_keys || v_key;

    SELECT * INTO v_p FROM public.products WHERE id = v_pid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
    IF v_p.approval_status <> 'approved' THEN RAISE EXCEPTION 'Produto indisponível'; END IF;

    IF v_p.is_unique THEN
      IF v_qty <> 1 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
      IF NOT (v_p.status = 'available'
              OR (v_p.status = 'reserved' AND (v_p.reserved_by = v_uid OR v_p.reserved_until < now()))) THEN
        RAISE EXCEPTION 'Produto indisponível';
      END IF;
    ELSE
      IF v_p.status <> 'available' THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
    END IF;

    IF v_vid IS NOT NULL THEN
      SELECT * INTO v_var FROM public.product_variations
       WHERE id = v_vid AND product_id = v_pid FOR UPDATE;
      IF NOT FOUND OR NOT v_var.is_active THEN RAISE EXCEPTION 'Variação inválida'; END IF;
      IF v_var.stock < v_qty THEN RAISE EXCEPTION 'Stock insuficiente'; END IF;
      v_price := COALESCE(v_var.price, v_p.base_price);
    ELSE
      IF NOT v_p.is_unique AND v_p.stock < v_qty THEN RAISE EXCEPTION 'Stock insuficiente'; END IF;
      v_price := v_p.base_price;
    END IF;

    v_subtotal := v_subtotal + v_price * v_qty;
    IF COALESCE(v_p.shipping_fee, 0) > 0 AND NOT (v_pid = ANY(v_seen)) THEN
      v_shipping := v_shipping + v_p.shipping_fee;
    END IF;
    v_seen := v_seen || v_pid;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_pid, 'variation_id', v_vid, 'quantity', v_qty,
      'price', v_price, 'seller_id', v_p.seller_id, 'is_unique', v_p.is_unique);
  END LOOP;

  INSERT INTO public.orders (
    user_id, subtotal, shipping, total, status, payment_method, payment_status,
    customer_name, customer_phone, shipping_address, payment_reference, payment_phone, notes,
    stock_finalized_at
  ) VALUES (
    v_uid, v_subtotal, v_shipping, v_subtotal + v_shipping, 'pending', _payment_method::public.payment_method, 'pending',
    left(btrim(COALESCE(_customer_name,'')), 120), left(btrim(COALESCE(_customer_phone,'')), 40),
    _shipping_address, left(COALESCE(_payment_reference,''), 80), left(COALESCE(_payment_phone,''), 40),
    left(COALESCE(_notes,''), 1000), now()
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    INSERT INTO public.order_items (order_id, product_id, variation_id, quantity, price, seller_id)
    VALUES (v_order_id, (v_item->>'product_id')::uuid, (v_item->>'variation_id')::uuid,
            (v_item->>'quantity')::int, (v_item->>'price')::numeric, (v_item->>'seller_id')::uuid);

    IF (v_item->>'is_unique')::boolean THEN
      UPDATE public.products
         SET status = 'reserved', reserved_by = v_uid, reserved_until = NULL, updated_at = now()
       WHERE id = (v_item->>'product_id')::uuid;
      DELETE FROM public.cart_items WHERE product_id = (v_item->>'product_id')::uuid;
    ELSIF v_item->>'variation_id' IS NOT NULL THEN
      UPDATE public.product_variations
         SET stock = stock - (v_item->>'quantity')::int
       WHERE id = (v_item->>'variation_id')::uuid;
    ELSE
      UPDATE public.products
         SET stock = stock - (v_item->>'quantity')::int
       WHERE id = (v_item->>'product_id')::uuid;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'subtotal', v_subtotal, 'shipping', v_shipping, 'total', v_subtotal + v_shipping);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.create_order_secure(jsonb, text, text, jsonb, text, text, text, text) TO authenticated;

-- 3) finalize_order_items idempotente (compatibilidade; create_order_secure já trata do stock)
CREATE OR REPLACE FUNCTION public.finalize_order_items(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_owner uuid; v_fin timestamptz; r RECORD;
BEGIN
  SELECT user_id, stock_finalized_at INTO v_owner, v_fin FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_owner IS NULL OR (v_owner <> v_uid AND NOT has_role(v_uid, 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF v_fin IS NOT NULL THEN RETURN; END IF; -- já finalizado: não descontar stock de novo
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
  UPDATE public.orders SET stock_finalized_at = now() WHERE id = _order_id;
END;
$function$;

-- 4) Vendedor/colaborador não pode alterar campos de moderação do produto
CREATE OR REPLACE FUNCTION public.protect_product_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.approval_status := OLD.approval_status;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_protect_product_approval
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.protect_product_approval();

-- 5) Suporte: utilizador comum não pode enviar mensagem como admin nem com sender_id alheio
DROP POLICY "Insert support messages if participant" ON public.support_messages;
CREATE POLICY "Insert support messages if participant"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    (NOT is_admin AND EXISTS (
      SELECT 1 FROM public.support_threads t
       WHERE t.id = support_messages.thread_id AND t.user_id = auth.uid()
    ))
    OR (is_admin AND public.has_role(auth.uid(), 'admin'))
  )
);

-- 6) Auditoria de ações sensíveis
CREATE OR REPLACE FUNCTION public.grant_admin_by_email(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem conceder acesso';
  END IF;
  INSERT INTO public.admin_allowlist (email) VALUES (lower(_email))
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), NULL,
          'admin_role', v_uid, 'admin.grant', jsonb_build_object('email', lower(_email)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_admin_by_email(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem remover acesso';
  END IF;
  DELETE FROM public.admin_allowlist WHERE lower(email) = lower(_email);
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_uid IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'admin';
  END IF;
  INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), NULL,
          'admin_role', v_uid, 'admin.revoke', jsonb_build_object('email', lower(_email)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_order_seller_status(_order_id uuid, _status text, _tracking text DEFAULT NULL::text, _notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_seller uuid := public.current_seller_id(); v_updated uuid;
BEGIN
  IF v_seller IS NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF _status NOT IN ('pending','processing','sent','delivered','cancelled') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;
  UPDATE public.order_sellers
     SET status = _status,
         tracking_code = COALESCE(_tracking, tracking_code),
         notes = COALESCE(_notes, notes),
         updated_at = now()
   WHERE order_id = _order_id
     AND (public.has_role(auth.uid(), 'admin') OR seller_id = v_seller)
  RETURNING seller_id INTO v_updated;
  IF v_updated IS NOT NULL THEN
    INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
    VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), v_updated,
            'order', _order_id, 'order.seller_status', jsonb_build_object('status', _status));
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.roleta_admin_generate_codes(_campaign_id uuid, _qty integer)
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE i int; c text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _qty IS NULL OR _qty < 1 OR _qty > 1000 THEN RAISE EXCEPTION 'Quantidade entre 1 e 1000'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.roleta_campaigns WHERE id = _campaign_id) THEN RAISE EXCEPTION 'Campanha inexistente'; END IF;
  FOR i IN 1.._qty LOOP
    c := public.roleta_random_code();
    INSERT INTO public.roleta_codes (code, campaign_id, origin, created_by) VALUES (c, _campaign_id, 'ADMIN', auth.uid());
    RETURN NEXT c;
  END LOOP;
  INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), NULL,
          'roleta', _campaign_id, 'roleta.generate_codes', jsonb_build_object('qty', _qty));
END
$function$;

-- 7) Defesa em profundidade: anon sem escrita em nenhuma tabela (nenhuma policy de escrita permite anon)
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
