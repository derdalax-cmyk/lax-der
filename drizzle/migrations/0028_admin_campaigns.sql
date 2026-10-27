-- lovable-cron-fallback-reviewed: queue worker is scheduled only when a campaign is enqueued and unschedules itself when the queue drains
CREATE TABLE public.admin_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('message','profile_recovery','products')),
  audience_type text NOT NULL CHECK (audience_type IN ('incomplete','all','push','email')),
  audience_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  title text NOT NULL,
  body text NOT NULL,
  cta_label text,
  cta_url text NOT NULL DEFAULT '/',
  image_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','sending','completed','failed','cancelled')),
  estimated_push integer NOT NULL DEFAULT 0,
  estimated_email integer NOT NULL DEFAULT 0,
  sent_push integer NOT NULL DEFAULT 0,
  sent_email integer NOT NULL DEFAULT 0,
  failed_push integer NOT NULL DEFAULT 0,
  failed_email integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
GRANT ALL ON public.admin_campaigns TO service_role;
ALTER TABLE public.admin_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_campaign_products (
  campaign_id uuid NOT NULL REFERENCES public.admin_campaigns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, product_id)
);
GRANT ALL ON public.admin_campaign_products TO service_role;
ALTER TABLE public.admin_campaign_products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.admin_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('push','email')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','skipped')),
  error_code text,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id, channel)
);
CREATE INDEX admin_campaign_recipients_queue ON public.admin_campaign_recipients (campaign_id, status);
GRANT ALL ON public.admin_campaign_recipients TO service_role;
ALTER TABLE public.admin_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_campaign_worker_key (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex')
);
GRANT ALL ON public.admin_campaign_worker_key TO service_role;
ALTER TABLE public.admin_campaign_worker_key ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_campaign_worker_key (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_campaign_audience(_segment text, _filters jsonb)
RETURNS TABLE(user_id uuid, has_push boolean, has_email boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
    EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = p.id)
      AND COALESCE((p.notification_preferences->>'marketing_push')::boolean, true),
    p.email IS NOT NULL AND p.email <> ''
      AND COALESCE((p.notification_preferences->>'email_enabled')::boolean, true)
      AND COALESCE((p.notification_preferences->>'marketing_email')::boolean, true)
      AND NOT EXISTS (SELECT 1 FROM suppressed_emails se WHERE lower(se.email) = lower(p.email))
  FROM profiles p
  WHERE NOT p.blocked
    AND (_segment <> 'incomplete' OR
         coalesce(btrim(p.name),'') = '' OR coalesce(btrim(p.phone),'') = '' OR
         coalesce(btrim(p.province),'') = '' OR coalesce(btrim(p.city),'') = '')
    AND (_segment <> 'push' OR EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = p.id))
    AND (_segment <> 'email' OR (p.email IS NOT NULL AND p.email <> ''))
    AND (coalesce(_filters->>'city','') = '' OR p.city = _filters->>'city')
    AND (coalesce(_filters->>'province','') = '' OR p.province = _filters->>'province')
    AND (coalesce(_filters->>'created_from','') = '' OR p.created_at >= (_filters->>'created_from')::timestamptz)
    AND (coalesce(_filters->>'created_to','') = '' OR p.created_at < ((_filters->>'created_to')::date + 1))
    AND (coalesce(_filters->>'purchases','') = '' OR
         ((_filters->>'purchases') = 'buyers') = EXISTS (SELECT 1 FROM orders o WHERE o.user_id = p.id AND o.status <> 'cancelled'))
    AND (coalesce(_filters->>'role','') = '' OR
         ((_filters->>'role') = 'sellers') = EXISTS (SELECT 1 FROM sellers sl WHERE sl.user_id = p.id AND sl.status = 'approved'))
$$;
REVOKE ALL ON FUNCTION public.admin_campaign_audience(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_campaign_audience(text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_campaign_estimate(_segment text, _filters jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('total', count(*), 'push', count(*) FILTER (WHERE has_push), 'email', count(*) FILTER (WHERE has_email))
  FROM public.admin_campaign_audience(_segment, _filters)
$$;
REVOKE ALL ON FUNCTION public.admin_campaign_estimate(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_campaign_estimate(text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_campaign_enqueue(_campaign_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; n integer := 0; k integer;
BEGIN
  SELECT * INTO c FROM admin_campaigns WHERE id = _campaign_id FOR UPDATE;
  IF c IS NULL OR c.status <> 'draft' THEN RAISE EXCEPTION 'CAMPAIGN_NOT_DRAFT'; END IF;
  IF c.channels ? 'push' THEN
    INSERT INTO admin_campaign_recipients (campaign_id, user_id, channel)
    SELECT _campaign_id, a.user_id, 'push' FROM admin_campaign_audience(c.audience_type, c.audience_filters) a WHERE a.has_push
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  END IF;
  IF c.channels ? 'email' THEN
    INSERT INTO admin_campaign_recipients (campaign_id, user_id, channel)
    SELECT _campaign_id, a.user_id, 'email' FROM admin_campaign_audience(c.audience_type, c.audience_filters) a WHERE a.has_email
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  END IF;
  UPDATE admin_campaigns SET status = CASE WHEN n = 0 THEN 'completed' ELSE 'queued' END,
    started_at = now(), completed_at = CASE WHEN n = 0 THEN now() END WHERE id = _campaign_id;
  IF n > 0 THEN
    PERFORM cron.schedule('admin-campaign-tick', '* * * * *', 'SELECT public.admin_campaign_tick()');
  END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.admin_campaign_enqueue(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_campaign_enqueue(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_campaign_claim(_limit integer)
RETURNS TABLE(id uuid, campaign_id uuid, user_id uuid, channel text, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE admin_campaign_recipients r SET status = 'failed', error_code = 'max_attempts', updated_at = now()
   WHERE r.status = 'processing' AND r.updated_at < now() - interval '10 minutes' AND r.attempts >= 3;
  RETURN QUERY
  WITH picked AS (
    SELECT r.id FROM admin_campaign_recipients r
    JOIN admin_campaigns c ON c.id = r.campaign_id AND c.status IN ('queued','sending')
    WHERE r.status = 'pending' OR (r.status = 'processing' AND r.updated_at < now() - interval '10 minutes')
    ORDER BY c.created_at, r.id
    LIMIT greatest(1, least(_limit, 100))
    FOR UPDATE OF r SKIP LOCKED
  )
  UPDATE admin_campaign_recipients r SET status = 'processing', attempts = r.attempts + 1, updated_at = now()
  FROM picked WHERE r.id = picked.id
  RETURNING r.id, r.campaign_id, r.user_id, r.channel, r.attempts;
  UPDATE admin_campaigns c SET status = 'sending' WHERE c.status = 'queued'
    AND EXISTS (SELECT 1 FROM admin_campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'processing');
END $$;
REVOKE ALL ON FUNCTION public.admin_campaign_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_campaign_claim(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_campaign_refresh(_campaign_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE open_count integer;
BEGIN
  UPDATE admin_campaigns c SET
    sent_push = s.sp, failed_push = s.fp, sent_email = s.se, failed_email = s.fe
  FROM (SELECT
    count(*) FILTER (WHERE channel='push' AND status='sent') sp,
    count(*) FILTER (WHERE channel='push' AND status='failed') fp,
    count(*) FILTER (WHERE channel='email' AND status='sent') se,
    count(*) FILTER (WHERE channel='email' AND status='failed') fe
    FROM admin_campaign_recipients WHERE campaign_id = _campaign_id) s
  WHERE c.id = _campaign_id;
  SELECT count(*) INTO open_count FROM admin_campaign_recipients WHERE campaign_id = _campaign_id AND status IN ('pending','processing');
  IF open_count = 0 THEN
    UPDATE admin_campaigns SET status = 'completed', completed_at = now() WHERE id = _campaign_id AND status IN ('queued','sending');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_campaign_refresh(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_campaign_refresh(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_campaign(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('title', c.title, 'body', c.body,
    'product_ids', COALESCE((SELECT jsonb_agg(cp.product_id ORDER BY cp.sort_order) FROM admin_campaign_products cp WHERE cp.campaign_id = c.id), '[]'::jsonb))
  FROM admin_campaigns c WHERE c.id = _id AND c.type = 'products' AND c.status IN ('queued','sending','completed')
$$;
GRANT EXECUTE ON FUNCTION public.get_public_campaign(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_campaign_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_campaign_recipients r JOIN admin_campaigns c ON c.id = r.campaign_id
                 WHERE r.status IN ('pending','processing') AND c.status IN ('queued','sending')) THEN
    BEGIN PERFORM cron.unschedule('admin-campaign-tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN;
  END IF;
  SELECT token INTO v_token FROM admin_campaign_worker_key WHERE id = 1;
  PERFORM net.http_post(
    url := 'https://project--67df5107-8177-480b-a27d-14dfb37e79d3.lovable.app/api/public/campaigns/process',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_token),
    body := '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.admin_campaign_tick() FROM PUBLIC, anon, authenticated;