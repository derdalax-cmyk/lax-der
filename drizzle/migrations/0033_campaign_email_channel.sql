-- lovable-cron-fallback-reviewed: same existing wake-on-enqueue campaign worker, unscheduled by admin_campaign_tick after drain; no new job
CREATE OR REPLACE FUNCTION public.admin_campaign_email_eligible(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=_user_id AND NOT p.blocked
 AND btrim(COALESCE(p.email,'')) ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)+$'
 AND COALESCE(p.notification_preferences->>'email_enabled','true')='true'
 AND COALESCE(p.notification_preferences->>'marketing_email','true')='true'
 AND NOT EXISTS (SELECT 1 FROM public.suppressed_emails se WHERE lower(se.email)=lower(btrim(p.email)))) $$;
REVOKE ALL ON FUNCTION public.admin_campaign_email_eligible(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_campaign_email_eligible(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_campaign_estimate(_segment text,_filters jsonb) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object('total',count(*),
 'push',count(*) FILTER (WHERE a.has_push AND public.admin_campaign_push_eligible(a.user_id)),
 'email',count(*) FILTER (WHERE public.admin_campaign_email_eligible(a.user_id)))
FROM public.admin_campaign_audience(_segment,_filters) a $$;
REVOKE ALL ON FUNCTION public.admin_campaign_estimate(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_campaign_estimate(text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_campaign_enqueue(_campaign_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c record; np integer := 0; ne integer := 0; e jsonb; BEGIN
SELECT * INTO c FROM public.admin_campaigns WHERE id=_campaign_id FOR UPDATE;
IF c IS NULL THEN RAISE EXCEPTION 'CAMPAIGN_MISSING'; END IF;
IF c.status <> 'draft' THEN RETURN (SELECT count(*)::integer FROM public.admin_campaign_recipients WHERE campaign_id=_campaign_id); END IF;
IF c.recipient_limit NOT IN (50,75,100) THEN RAISE EXCEPTION 'INVALID_RECIPIENT_LIMIT'; END IF;
e := public.admin_campaign_estimate(c.audience_type,c.audience_filters);
IF c.channels ? 'push' THEN
 INSERT INTO public.admin_campaign_recipients(campaign_id,user_id,channel) SELECT _campaign_id,a.user_id,'push' FROM public.admin_campaign_audience(c.audience_type,c.audience_filters) a WHERE a.has_push AND public.admin_campaign_push_eligible(a.user_id) ORDER BY a.user_id LIMIT c.recipient_limit ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS np=ROW_COUNT;
END IF;
IF c.channels ? 'email' THEN
 INSERT INTO public.admin_campaign_recipients(campaign_id,user_id,channel) SELECT _campaign_id,a.user_id,'email' FROM public.admin_campaign_audience(c.audience_type,c.audience_filters) a WHERE public.admin_campaign_email_eligible(a.user_id) ORDER BY a.user_id LIMIT c.recipient_limit ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS ne=ROW_COUNT;
END IF;
UPDATE public.admin_campaigns SET eligible_total=COALESCE((e->>'total')::integer,0),
 estimated_push=CASE WHEN c.channels ? 'push' THEN COALESCE((e->>'push')::integer,0) ELSE 0 END,
 estimated_email=CASE WHEN c.channels ? 'email' THEN COALESCE((e->>'email')::integer,0) ELSE 0 END,
 queued_push=np,queued_email=ne,status=CASE WHEN np+ne=0 THEN 'completed' ELSE 'queued' END,started_at=now(),completed_at=CASE WHEN np+ne=0 THEN now() END WHERE id=_campaign_id;
IF np+ne>0 THEN PERFORM cron.schedule('admin-campaign-tick','* * * * *','SELECT public.admin_campaign_tick()'); END IF; RETURN np+ne; END $$;
REVOKE ALL ON FUNCTION public.admin_campaign_enqueue(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_campaign_enqueue(uuid) TO service_role;