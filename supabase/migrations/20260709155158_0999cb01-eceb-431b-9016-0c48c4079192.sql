
-- ============ conversations ============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  last_message text,
  last_message_at timestamptz,
  buyer_unread integer NOT NULL DEFAULT 0,
  seller_unread integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, seller_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_user_id);

CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_user_id);

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_conversations_buyer ON public.conversations(buyer_id);
CREATE INDEX idx_conversations_seller_user ON public.conversations(seller_user_id);

-- ============ messages ============
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_user_id = auth.uid())
  ));

CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_user_id = auth.uid())
    )
  );

CREATE POLICY "Participants can update messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_user_id = auth.uid())
  ));

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);

-- ============ start_conversation ============
CREATE OR REPLACE FUNCTION public.start_conversation(_seller_id uuid, _product_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_seller_user uuid;
  v_conv uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT user_id INTO v_seller_user FROM sellers WHERE id = _seller_id AND status = 'approved';
  IF v_seller_user IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;
  IF v_seller_user = v_uid THEN RAISE EXCEPTION 'Não pode conversar com a sua própria loja'; END IF;

  SELECT id INTO v_conv FROM conversations WHERE buyer_id = v_uid AND seller_id = _seller_id;
  IF v_conv IS NULL THEN
    INSERT INTO conversations (buyer_id, seller_id, seller_user_id, product_id)
    VALUES (v_uid, _seller_id, v_seller_user, _product_id)
    RETURNING id INTO v_conv;
  ELSIF _product_id IS NOT NULL THEN
    UPDATE conversations SET product_id = _product_id WHERE id = v_conv;
  END IF;
  RETURN v_conv;
END;
$$;

-- ============ message insert trigger ============
CREATE OR REPLACE FUNCTION public.on_new_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conv conversations%ROWTYPE;
  v_recipient uuid;
  v_sender_name text;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;
  IF NEW.sender_id = v_conv.buyer_id THEN
    v_recipient := v_conv.seller_user_id;
    UPDATE conversations SET last_message = NEW.body, last_message_at = NEW.created_at,
      seller_unread = seller_unread + 1, updated_at = now() WHERE id = NEW.conversation_id;
    SELECT COALESCE(NULLIF(name,''),'Um cliente') INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  ELSE
    v_recipient := v_conv.buyer_id;
    UPDATE conversations SET last_message = NEW.body, last_message_at = NEW.created_at,
      buyer_unread = buyer_unread + 1, updated_at = now() WHERE id = NEW.conversation_id;
    SELECT store_name INTO v_sender_name FROM sellers WHERE id = v_conv.seller_id;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, link, data)
  VALUES (
    v_recipient, 'message',
    'Nova mensagem de ' || COALESCE(v_sender_name, 'DERDALAX'),
    left(NEW.body, 90),
    '/mensagens',
    jsonb_build_object('conversation_id', NEW.conversation_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.on_new_message();

-- ============ mark_conversation_read ============
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conv conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = _conversation_id;
  IF v_conv.id IS NULL THEN RETURN; END IF;
  IF v_uid = v_conv.buyer_id THEN
    UPDATE conversations SET buyer_unread = 0 WHERE id = _conversation_id;
    UPDATE messages SET read = true WHERE conversation_id = _conversation_id AND sender_id <> v_uid AND read = false;
  ELSIF v_uid = v_conv.seller_user_id THEN
    UPDATE conversations SET seller_unread = 0 WHERE id = _conversation_id;
    UPDATE messages SET read = true WHERE conversation_id = _conversation_id AND sender_id <> v_uid AND read = false;
  END IF;
END;
$$;

-- ============ get_my_conversations ============
CREATE OR REPLACE FUNCTION public.get_my_conversations()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'last_message_at') DESC NULLS LAST), '[]'::jsonb) INTO v
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'role', CASE WHEN c.buyer_id = v_uid THEN 'buyer' ELSE 'seller' END,
      'seller_id', c.seller_id,
      'product_id', c.product_id,
      'last_message', c.last_message,
      'last_message_at', c.last_message_at,
      'unread', CASE WHEN c.buyer_id = v_uid THEN c.buyer_unread ELSE c.seller_unread END,
      'name', CASE WHEN c.buyer_id = v_uid THEN s.store_name ELSE COALESCE(NULLIF(pr.name,''),'Cliente') END,
      'avatar', CASE WHEN c.buyer_id = v_uid THEN s.logo_url ELSE pr.avatar_url END
    ) AS row
    FROM conversations c
    JOIN sellers s ON s.id = c.seller_id
    LEFT JOIN profiles pr ON pr.id = c.buyer_id
    WHERE c.buyer_id = v_uid OR c.seller_user_id = v_uid
  ) t;
  RETURN v;
END;
$$;

-- ============ realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
