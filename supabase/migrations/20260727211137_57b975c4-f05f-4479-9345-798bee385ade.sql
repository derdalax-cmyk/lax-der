-- 1) Table
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  keys jsonb NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subs_select_own" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "push_subs_insert_own" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subs_update_own" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subs_delete_own" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);

-- 2) Store dispatch shared secret in vault
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_dispatch_secret') THEN
    UPDATE vault.secrets
       SET secret = 'OgS7BQz5K05Xx-FXVf60tP2EgvD6WRbWQhlxkhzjt_mfJjmO'
     WHERE name = 'push_dispatch_secret';
  ELSE
    PERFORM vault.create_secret('OgS7BQz5K05Xx-FXVf60tP2EgvD6WRbWQhlxkhzjt_mfJjmO', 'push_dispatch_secret');
  END IF;
END $$;

-- 3) Helper to POST to the dispatcher (best-effort, never fails the caller)
CREATE OR REPLACE FUNCTION public.notify_push(
  _user_id uuid,
  _title text,
  _body text,
  _url text,
  _tag text
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
      url := 'https://project--67df5107-8177-480b-a27d-14dfb37e79d3.lovable.app/api/public/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := jsonb_build_object(
        'user_id', _user_id,
        'title', _title,
        'body', _body,
        'url', _url,
        'tag', _tag
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_push failed: %', SQLERRM;
  END;
END;
$function$;

-- 4) Trigger on notifications: mirror every in-app notification to push
CREATE OR REPLACE FUNCTION public.on_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
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

DROP TRIGGER IF EXISTS trg_notifications_push ON public.notifications;
CREATE TRIGGER trg_notifications_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.on_notification_push();
