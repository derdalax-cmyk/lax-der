-- 1) Preferências de notificação por utilizador
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT jsonb_build_object(
    'push', jsonb_build_object('order', true, 'order_status', true, 'new_seller', true, 'message', true, 'default', true),
    'email', jsonb_build_object('order', true, 'order_status', true, 'new_seller', true)
  );

-- 2) Push respeita preferências
CREATE OR REPLACE FUNCTION public.on_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pref boolean;
BEGIN
  SELECT COALESCE((notification_preferences->'push'->>NEW.type)::boolean, true)
    INTO v_pref
    FROM public.profiles
    WHERE id = NEW.user_id;

  IF v_pref = false THEN
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

-- 3) Helper que chama o dispatcher de email (reaproveita o secret do push)
CREATE OR REPLACE FUNCTION public.notify_email(
  _user_id uuid,
  _type text,
  _title text,
  _body text,
  _link text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'push_dispatch_secret';
  IF v_secret IS NULL THEN RETURN; END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://project--67df5107-8177-480b-a27d-14dfb37e79d3.lovable.app/api/public/email/dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := jsonb_build_object(
        'user_id', _user_id,
        'type', _type,
        'title', _title,
        'body', _body,
        'link', _link
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_email failed: %', SQLERRM;
  END;
END;
$function$;

-- 4) Trigger em notifications que despacha email para tipos-chave
CREATE OR REPLACE FUNCTION public.on_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pref boolean;
BEGIN
  IF NEW.type NOT IN ('order', 'order_status', 'new_seller') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE((notification_preferences->'email'->>NEW.type)::boolean, true)
    INTO v_pref
    FROM public.profiles
    WHERE id = NEW.user_id;

  IF v_pref = false THEN
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

DROP TRIGGER IF EXISTS trg_notifications_email ON public.notifications;
CREATE TRIGGER trg_notifications_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.on_notification_email();

-- 5) Novo vendedor cadastrado -> notifica todos os admins
CREATE OR REPLACE FUNCTION public.notify_admins_new_seller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_admin uuid;
BEGIN
  FOR v_admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (
      v_admin,
      'new_seller',
      'Novo vendedor cadastrado',
      COALESCE(NEW.store_name, 'Uma loja') || ' aguarda verificação de documentos.',
      '/admin/vendedores',
      jsonb_build_object('seller_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_admins_new_seller failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_seller ON public.sellers;
CREATE TRIGGER trg_notify_admins_new_seller
  AFTER INSERT ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_seller();