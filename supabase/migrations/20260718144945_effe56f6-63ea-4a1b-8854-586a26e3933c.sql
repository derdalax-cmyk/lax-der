
-- =================== SUPPORT CHAT ===================
CREATE TABLE public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message text,
  last_message_at timestamptz,
  user_unread int NOT NULL DEFAULT 0,
  admin_unread int NOT NULL DEFAULT 0,
  resolved boolean NOT NULL DEFAULT false,
  welcomed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own support thread" ON public.support_threads
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users update own support thread" ON public.support_threads
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users insert own support thread" ON public.support_threads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_admin boolean NOT NULL DEFAULT false,
  body text,
  image_url text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_messages_thread_idx ON public.support_messages(thread_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read support messages if participant" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
  );

CREATE POLICY "Insert support messages if participant" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
  );

-- Trigger to update thread stats + notifications when a new message arrives
CREATE OR REPLACE FUNCTION public.on_new_support_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_body text := left(COALESCE(NEW.body, '[imagem]'), 120);
BEGIN
  SELECT user_id INTO v_user FROM support_threads WHERE id = NEW.thread_id;
  IF NEW.is_admin THEN
    UPDATE support_threads SET
      last_message = v_body, last_message_at = NEW.created_at,
      user_unread = user_unread + 1, updated_at = now()
    WHERE id = NEW.thread_id;
    IF v_user IS NOT NULL AND NEW.sender_id IS DISTINCT FROM v_user THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (v_user, 'support', 'Nova resposta do suporte', v_body, '/suporte');
    END IF;
  ELSE
    UPDATE support_threads SET
      last_message = v_body, last_message_at = NEW.created_at,
      admin_unread = admin_unread + 1, updated_at = now()
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_on_new_support_message
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.on_new_support_message();

-- Open (or reuse) a support thread and send the welcome message once
CREATE OR REPLACE FUNCTION public.open_support_thread()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_welcomed boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT id, welcomed INTO v_id, v_welcomed FROM support_threads WHERE user_id = v_uid;
  IF v_id IS NULL THEN
    INSERT INTO support_threads (user_id) VALUES (v_uid) RETURNING id INTO v_id;
    v_welcomed := false;
  END IF;
  IF v_welcomed IS DISTINCT FROM true THEN
    INSERT INTO support_messages (thread_id, sender_id, is_admin, body)
    VALUES (v_id, NULL, true,
      E'👋 Olá! Bem-vindo ao suporte da DERDALAX.\n\nEste é o canal oficial para entrar em contacto diretamente com a nossa equipa.\nEstamos aqui para ajudar com:\n✅ Dúvidas sobre pedidos\n✅ Problemas com entregas\n✅ Informações sobre produtos\n✅ Qualquer outra questão\n\nComo podemos ajudar hoje?');
    UPDATE support_threads SET welcomed = true WHERE id = v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_support_read(_thread_id uuid, _side text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF _side = 'admin' AND public.has_role(v_uid,'admin') THEN
    UPDATE support_threads SET admin_unread = 0 WHERE id = _thread_id;
    UPDATE support_messages SET read = true WHERE thread_id = _thread_id AND is_admin = false AND read = false;
  ELSIF _side = 'user' THEN
    UPDATE support_threads SET user_unread = 0
      WHERE id = _thread_id AND user_id = v_uid;
    UPDATE support_messages SET read = true
      WHERE thread_id = _thread_id AND is_admin = true AND read = false
        AND EXISTS (SELECT 1 FROM support_threads t WHERE t.id = _thread_id AND t.user_id = v_uid);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.get_admin_support_threads()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Apenas admin'; END IF;
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'last_message_at') DESC NULLS LAST), '[]'::jsonb) INTO v
  FROM (
    SELECT jsonb_build_object(
      'id', t.id,
      'user_id', t.user_id,
      'name', COALESCE(NULLIF(p.name,''), p.email, 'Cliente'),
      'email', p.email,
      'avatar', p.avatar_url,
      'last_message', t.last_message,
      'last_message_at', t.last_message_at,
      'admin_unread', t.admin_unread,
      'resolved', t.resolved
    ) AS row
    FROM support_threads t
    LEFT JOIN profiles p ON p.id = t.user_id
  ) q;
  RETURN v;
END; $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads;

-- =================== CATEGORIES ===================
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorias públicas" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admin gere categorias" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_categories_updated
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.categories (slug, label, icon, sort_order) VALUES
  ('camisas','Camisas','shirt',10),
  ('calcas','Calças','pants',20),
  ('sapatos','Sapatos','footprints',30),
  ('chapeus','Chapéus','hard-hat',40),
  ('calcoes','Calções','scissors',50),
  ('casacos','Casacos','coat',60)
ON CONFLICT (slug) DO NOTHING;

-- =================== FEATURED AUTO-APPROVE ===================
ALTER TABLE public.featured_collections
  ADD COLUMN IF NOT EXISTS auto_approve boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.auto_approve_featured_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_auto boolean;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT auto_approve INTO v_auto FROM featured_collections WHERE id = NEW.collection_id;
    IF v_auto THEN NEW.status := 'approved'; END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_approve_featured ON public.featured_collection_products;
CREATE TRIGGER trg_auto_approve_featured
BEFORE INSERT ON public.featured_collection_products
FOR EACH ROW EXECUTE FUNCTION public.auto_approve_featured_submission();
