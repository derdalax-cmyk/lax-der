ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
COMMENT ON COLUMN public.conversations.seller_user_id IS 'Historical snapshot of the store owner at creation; authorization uses sellers.user_id';

-- Participant helper: buyer or CURRENT store owner (never collaborators)
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.sellers s ON s.id = c.seller_id
    WHERE c.id = _conversation_id
      AND auth.uid() IS NOT NULL
      AND (c.buyer_id = auth.uid() OR s.user_id = auth.uid())
  )
$$;

-- Policies
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations" ON public.conversations
  FOR SELECT TO authenticated USING (public.is_conversation_participant(id));

DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can update messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages
  FOR SELECT TO authenticated USING (public.is_conversation_participant(conversation_id));
CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND edited_at IS NULL AND deleted_at IS NULL
    AND public.is_conversation_participant(conversation_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.conversations c JOIN public.sellers s ON s.id = c.seller_id
      WHERE c.id = conversation_id AND c.buyer_id = s.user_id
    )
  );

-- Preview recalculation
CREATE OR REPLACE FUNCTION public.refresh_conversation_preview(_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg public.messages%ROWTYPE;
BEGIN
  SELECT * INTO v_msg FROM public.messages WHERE conversation_id = _conversation_id
  ORDER BY created_at DESC LIMIT 1;
  IF v_msg.id IS NULL THEN RETURN; END IF;
  UPDATE public.conversations
     SET last_message = CASE WHEN v_msg.deleted_at IS NOT NULL THEN 'Mensagem apagada' ELSE v_msg.body END,
         last_message_at = v_msg.created_at,
         updated_at = now()
   WHERE id = _conversation_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_conversation_preview(uuid) FROM PUBLIC, anon, authenticated;

-- Edit own message (15 minutes)
CREATE OR REPLACE FUNCTION public.edit_message(_message_id uuid, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_msg public.messages%ROWTYPE; v_body text := btrim(coalesce(_body, ''));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = _message_id FOR UPDATE;
  IF v_msg.id IS NULL OR v_msg.sender_id <> v_uid THEN RAISE EXCEPTION 'Só pode editar as suas próprias mensagens'; END IF;
  IF NOT public.is_conversation_participant(v_msg.conversation_id) THEN RAISE EXCEPTION 'Sem acesso a esta conversa'; END IF;
  IF v_msg.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Mensagem apagada não pode ser editada'; END IF;
  IF now() > v_msg.created_at + interval '15 minutes' THEN RAISE EXCEPTION 'Só pode editar nos primeiros 15 minutos'; END IF;
  IF v_body = '' THEN RAISE EXCEPTION 'A mensagem não pode ficar vazia'; END IF;
  IF length(v_body) > 4000 THEN RAISE EXCEPTION 'Mensagem demasiado longa'; END IF;
  IF v_body = v_msg.body THEN RETURN; END IF;
  UPDATE public.messages SET body = v_body, edited_at = now() WHERE id = _message_id;
  PERFORM public.refresh_conversation_preview(v_msg.conversation_id);
END;
$$;

-- Soft delete own message (no time limit)
CREATE OR REPLACE FUNCTION public.delete_message(_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_msg public.messages%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = _message_id FOR UPDATE;
  IF v_msg.id IS NULL OR v_msg.sender_id <> v_uid THEN RAISE EXCEPTION 'Só pode apagar as suas próprias mensagens'; END IF;
  IF NOT public.is_conversation_participant(v_msg.conversation_id) THEN RAISE EXCEPTION 'Sem acesso a esta conversa'; END IF;
  IF v_msg.deleted_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.messages SET deleted_at = now(), body = '' WHERE id = _message_id;
  PERFORM public.refresh_conversation_preview(v_msg.conversation_id);
END;
$$;

-- Single order conversation per order + store
CREATE OR REPLACE FUNCTION public.get_or_create_order_conversation(_order_id uuid, _seller_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_buyer uuid; v_owner uuid; v_conv uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT user_id INTO v_buyer FROM public.orders WHERE id = _order_id;
  IF v_buyer IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  SELECT user_id INTO v_owner FROM public.sellers WHERE id = _seller_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;
  IF v_uid <> v_buyer AND v_uid <> v_owner THEN RAISE EXCEPTION 'Sem acesso a este pedido'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.order_items oi LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id AND (oi.seller_id = _seller_id OR p.seller_id = _seller_id)
  ) THEN RAISE EXCEPTION 'Loja não pertence a este pedido'; END IF;
  IF v_buyer = v_owner THEN RAISE EXCEPTION 'Não pode conversar com a sua própria loja'; END IF;

  SELECT id INTO v_conv FROM public.conversations
   WHERE buyer_id = v_buyer AND seller_id = _seller_id AND order_id = _order_id;
  IF v_conv IS NULL THEN
    INSERT INTO public.conversations (buyer_id, seller_id, seller_user_id, order_id)
    VALUES (v_buyer, _seller_id, v_owner, _order_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_conv;
    IF v_conv IS NULL THEN
      SELECT id INTO v_conv FROM public.conversations
       WHERE buyer_id = v_buyer AND seller_id = _seller_id AND order_id = _order_id;
    END IF;
  END IF;
  RETURN v_conv;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_or_create_order_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_message(uuid) TO authenticated;

-- Legacy entry point now resolves to the same conversation
CREATE OR REPLACE FUNCTION public.start_order_conversation(_order_id uuid, _seller_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.get_or_create_order_conversation(_order_id, _seller_id);
END;
$$;

-- General (pre-purchase) conversation: no longer overwrites product context
CREATE OR REPLACE FUNCTION public.start_conversation(_seller_id uuid, _product_id uuid DEFAULT NULL::uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_owner uuid; v_conv uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT user_id INTO v_owner FROM public.sellers WHERE id = _seller_id AND status = 'approved';
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;
  IF v_owner = v_uid THEN RAISE EXCEPTION 'Não pode conversar com a sua própria loja'; END IF;
  SELECT id INTO v_conv FROM public.conversations
   WHERE buyer_id = v_uid AND seller_id = _seller_id AND order_id IS NULL;
  IF v_conv IS NULL THEN
    INSERT INTO public.conversations (buyer_id, seller_id, seller_user_id, product_id)
    VALUES (v_uid, _seller_id, v_owner, _product_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_conv;
    IF v_conv IS NULL THEN
      SELECT id INTO v_conv FROM public.conversations
       WHERE buyer_id = v_uid AND seller_id = _seller_id AND order_id IS NULL;
    END IF;
  ELSIF _product_id IS NOT NULL THEN
    UPDATE public.conversations SET product_id = _product_id WHERE id = v_conv AND product_id IS NULL;
  END IF;
  RETURN v_conv;
END;
$$;

-- Read status uses the current owner
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_buyer uuid; v_owner uuid;
BEGIN
  SELECT c.buyer_id, s.user_id INTO v_buyer, v_owner
    FROM public.conversations c JOIN public.sellers s ON s.id = c.seller_id
   WHERE c.id = _conversation_id;
  IF v_buyer IS NULL OR v_uid IS NULL THEN RETURN; END IF;
  IF v_uid = v_buyer THEN
    UPDATE public.conversations SET buyer_unread = 0 WHERE id = _conversation_id AND buyer_unread <> 0;
  ELSIF v_uid = v_owner THEN
    UPDATE public.conversations SET seller_unread = 0 WHERE id = _conversation_id AND seller_unread <> 0;
  ELSE
    RETURN;
  END IF;
  UPDATE public.messages SET read = true
   WHERE conversation_id = _conversation_id AND sender_id <> v_uid AND read = false;
END;
$$;

-- New message: counters + direct links
CREATE OR REPLACE FUNCTION public.on_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conv public.conversations%ROWTYPE; v_owner uuid; v_recipient uuid; v_sender_name text; v_link text;
BEGIN
  SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;
  SELECT user_id INTO v_owner FROM public.sellers WHERE id = v_conv.seller_id;
  IF NEW.sender_id = v_conv.buyer_id THEN
    v_recipient := COALESCE(v_owner, v_conv.seller_user_id);
    v_link := '/vendedor/mensagens/' || NEW.conversation_id;
    UPDATE public.conversations SET last_message = NEW.body, last_message_at = NEW.created_at,
      seller_unread = seller_unread + 1, updated_at = now() WHERE id = NEW.conversation_id;
    SELECT COALESCE(NULLIF(name,''),'Um cliente') INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  ELSE
    v_recipient := v_conv.buyer_id;
    v_link := '/mensagens?c=' || NEW.conversation_id;
    UPDATE public.conversations SET last_message = NEW.body, last_message_at = NEW.created_at,
      buyer_unread = buyer_unread + 1, updated_at = now() WHERE id = NEW.conversation_id;
    SELECT store_name INTO v_sender_name FROM public.sellers WHERE id = v_conv.seller_id;
  END IF;
  IF v_recipient IS NOT NULL AND v_recipient <> NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (v_recipient, 'message', 'Nova mensagem de ' || COALESCE(v_sender_name, 'DERDALAX'),
      left(NEW.body, 90), v_link, jsonb_build_object('conversation_id', NEW.conversation_id));
  END IF;
  RETURN NEW;
END;
$$;

-- Conversation list with context (general vs order); hides self-conversations
CREATE OR REPLACE FUNCTION public.get_my_conversations()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'last_message_at') DESC NULLS LAST), '[]'::jsonb) INTO v
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'role', CASE WHEN c.buyer_id = v_uid THEN 'buyer' ELSE 'seller' END,
      'kind', CASE WHEN c.order_id IS NULL THEN 'general' ELSE 'order' END,
      'seller_id', c.seller_id,
      'product_id', c.product_id,
      'order_id', c.order_id,
      'last_message', c.last_message,
      'last_message_at', COALESCE(c.last_message_at, c.created_at),
      'unread', CASE WHEN c.buyer_id = v_uid THEN c.buyer_unread ELSE c.seller_unread END,
      'name', CASE WHEN c.buyer_id = v_uid THEN s.store_name ELSE COALESCE(NULLIF(pr.name,''),'Cliente') END,
      'avatar', CASE WHEN c.buyer_id = v_uid THEN s.logo_url ELSE pr.avatar_url END,
      'phone', CASE WHEN c.buyer_id = v_uid THEN s.phone ELSE pr.phone END
    ) AS row
    FROM public.conversations c
    JOIN public.sellers s ON s.id = c.seller_id
    LEFT JOIN public.profiles pr ON pr.id = c.buyer_id
    WHERE (c.buyer_id = v_uid OR s.user_id = v_uid)
      AND c.buyer_id IS DISTINCT FROM s.user_id
  ) t;
  RETURN v;
END;
$$;