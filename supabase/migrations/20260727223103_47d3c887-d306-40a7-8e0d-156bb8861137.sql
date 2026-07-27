
-- ===== 1) Simplificar notification_preferences para 2 flags =====
-- Migrar valores existentes: se qualquer sub-flag do canal estava true, o canal fica true; caso contrário false.
UPDATE public.profiles
   SET notification_preferences = jsonb_build_object(
     'push_enabled',
       COALESCE((
         SELECT bool_or(COALESCE(v::text::boolean, true))
           FROM jsonb_each(COALESCE(notification_preferences->'push','{}'::jsonb)) AS e(k,v)
       ), true),
     'email_enabled',
       COALESCE((
         SELECT bool_or(COALESCE(v::text::boolean, true))
           FROM jsonb_each(COALESCE(notification_preferences->'email','{}'::jsonb)) AS e(k,v)
       ), true)
   )
 WHERE (notification_preferences ? 'push') OR (notification_preferences ? 'email')
    OR NOT (notification_preferences ? 'push_enabled');

ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT jsonb_build_object('push_enabled', true, 'email_enabled', true);

-- ===== 2) Push respeita push_enabled =====
CREATE OR REPLACE FUNCTION public.on_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT COALESCE((notification_preferences->>'push_enabled')::boolean, true)
    INTO v_enabled
    FROM public.profiles
   WHERE id = NEW.user_id;

  IF v_enabled = false THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_push(
    NEW.user_id,
    NEW.title,
    COALESCE(NEW.body, ''),
    COALESCE(NEW.link, '/'),
    COALESCE(NEW.type, 'default')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'on_notification_push failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- ===== 3) Email respeita email_enabled (whitelist de tipos) =====
CREATE OR REPLACE FUNCTION public.on_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_enabled boolean;
BEGIN
  IF NEW.type NOT IN ('order','order_status','new_seller','welcome','seller_pending','seller_approved','report') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE((notification_preferences->>'email_enabled')::boolean, true)
    INTO v_enabled
    FROM public.profiles
   WHERE id = NEW.user_id;

  IF v_enabled = false THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_email(
    NEW.user_id,
    NEW.type,
    NEW.title,
    COALESCE(NEW.body, ''),
    COALESCE(NEW.link, '/')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'on_notification_email failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- ===== 4) Boas-vindas ao criar conta (compradores) =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role app_role := 'client';
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));

  IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE lower(email) = lower(NEW.email)) THEN
    v_role := 'admin';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  IF v_role = 'client' THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (
        NEW.id,
        'welcome',
        'Bem-vindo à DERDALAX',
        'Encontre peças únicas selecionadas para si. Explore a nossa coleção e descubra o seu estilo.',
        '/'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'welcome notification failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- ===== 5) Cadastro de vendedor: deixa de aprovar automaticamente =====
DROP TRIGGER IF EXISTS trg_auto_approve_seller ON public.sellers;

-- Confirmação "em análise" ao vendedor recém-cadastrado
CREATE OR REPLACE FUNCTION public.notify_seller_pending_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (
      NEW.user_id,
      'seller_pending',
      'Recebemos o seu cadastro',
      'Vamos analisar os seus documentos e avisamos assim que a sua loja for aprovada. Obrigado por escolher a DERDALAX.',
      '/vendedor',
      jsonb_build_object('seller_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_seller_pending_review failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_seller_pending_review ON public.sellers;
CREATE TRIGGER trg_notify_seller_pending_review
  AFTER INSERT ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.notify_seller_pending_review();

-- Aprovação da loja pelo admin → notifica só aquele vendedor
CREATE OR REPLACE FUNCTION public.notify_seller_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (
      NEW.user_id,
      'seller_approved',
      'A sua loja foi aprovada',
      'Já pode publicar produtos na DERDALAX e começar a vender. Bem-vindo(a) à nossa comunidade de vendedores.',
      '/vendedor',
      jsonb_build_object('seller_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_seller_approved failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_seller_approved ON public.sellers;
CREATE TRIGGER trg_notify_seller_approved
  AFTER UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.notify_seller_approved();

-- ===== 6) Denúncias (reports) =====
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('product','user','seller')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage reports" ON public.reports;
CREATE POLICY "Admins manage reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.notify_admins_new_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_admin uuid;
  v_label text;
BEGIN
  v_label := CASE NEW.target_type
    WHEN 'product' THEN 'um produto'
    WHEN 'seller'  THEN 'uma loja'
    ELSE 'um utilizador'
  END;

  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (
      v_admin,
      'report',
      'Nova denúncia recebida',
      'Foi reportado ' || v_label || ' — motivo: ' || COALESCE(NEW.reason, 'não especificado'),
      '/admin/denuncias',
      jsonb_build_object('report_id', NEW.id, 'target_type', NEW.target_type, 'target_id', NEW.target_id)
    );
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_admins_new_report failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_report ON public.reports;
CREATE TRIGGER trg_notify_admins_new_report
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_report();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON public.reports;
CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
