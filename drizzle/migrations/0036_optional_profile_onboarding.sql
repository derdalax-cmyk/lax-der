ALTER TABLE public.profiles ADD COLUMN profile_completion_dismissed_at timestamptz, ADD COLUMN profile_completion_reminder_sent_at timestamptz;
CREATE FUNCTION public.profile_is_complete(_name text,_phone text,_province text,_city text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT COALESCE(length(btrim(_name))>0 AND regexp_replace(regexp_replace(_phone,'[\s\-().]','','g'),'^(\+|00)?258','') ~ '^8[2-8][0-9]{7}$' AND _province=ANY(ARRAY['Maputo Província','Gaza','Inhambane','Sofala','Manica','Tete','Zambézia','Nampula','Cabo Delgado','Niassa']) AND length(btrim(_city))>0,false) $$;
CREATE TABLE public.profile_completion_reminders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, cycle_id uuid NOT NULL, channel text NOT NULL CHECK(channel IN ('email','push')), due_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','skipped','failed')), attempts integer NOT NULL DEFAULT 0, dispatch_started_at timestamptz, accepted_at timestamptz, provider_id text, error_code text, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,cycle_id,channel));
GRANT ALL ON public.profile_completion_reminders TO service_role;
ALTER TABLE public.profile_completion_reminders ENABLE ROW LEVEL SECURITY;
CREATE INDEX profile_reminder_due_idx ON public.profile_completion_reminders(due_at) WHERE status IN ('pending','processing');
CREATE FUNCTION public.profile_onboarding_state() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF current_setting('role',true) IN ('authenticated','anon') AND current_setting('derdalax.onboarding_dismiss',true) IS DISTINCT FROM 'allowed' THEN
IF TG_OP='INSERT' THEN NEW.profile_completion_dismissed_at:=NULL; NEW.profile_completion_reminder_sent_at:=NULL;
ELSE NEW.profile_completion_dismissed_at:=OLD.profile_completion_dismissed_at; NEW.profile_completion_reminder_sent_at:=OLD.profile_completion_reminder_sent_at; END IF;
END IF;
IF public.profile_is_complete(NEW.name,NEW.phone,NEW.province,NEW.city) THEN
NEW.profile_completion_dismissed_at:=NULL; NEW.profile_completion_reminder_sent_at:=NULL;
UPDATE public.profile_completion_reminders SET status='skipped',error_code='profile_completed',updated_at=now() WHERE user_id=NEW.id AND status IN ('pending','processing') AND dispatch_started_at IS NULL;
END IF; RETURN NEW; END $$;
CREATE TRIGGER zz_profile_onboarding_state BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profile_onboarding_state();
CREATE FUNCTION public.dismiss_profile_completion() RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.profiles; v_cycle uuid; v_at timestamptz:=now(); BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
SELECT * INTO p FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
IF p.id IS NULL OR public.profile_is_complete(p.name,p.phone,p.province,p.city) THEN RETURN NULL; END IF;
IF p.profile_completion_dismissed_at > now()-interval '7 days' THEN RETURN p.profile_completion_dismissed_at; END IF;
PERFORM set_config('derdalax.onboarding_dismiss','allowed',true);
UPDATE public.profiles SET profile_completion_dismissed_at=v_at WHERE id=p.id;
IF p.profile_completion_dismissed_at IS NULL AND p.profile_completion_reminder_sent_at IS NULL THEN
v_cycle:=gen_random_uuid(); INSERT INTO public.profile_completion_reminders(user_id,cycle_id,channel,due_at) VALUES(p.id,v_cycle,'email',v_at+interval '30 minutes'),(p.id,v_cycle,'push',v_at+interval '30 minutes');
PERFORM cron.alter_job(341,active:=true);
END IF; RETURN v_at; END $$;
REVOKE ALL ON FUNCTION public.dismiss_profile_completion() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.dismiss_profile_completion() TO authenticated;
CREATE FUNCTION public.profile_reminder_claim() RETURNS SETOF public.profile_completion_reminders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
UPDATE public.profile_completion_reminders SET status='failed',error_code='delivery_unknown' WHERE status='processing' AND dispatch_started_at IS NOT NULL AND updated_at<now()-interval '10 minutes';
RETURN QUERY UPDATE public.profile_completion_reminders SET status='processing',attempts=attempts+1,updated_at=now() WHERE id IN (SELECT id FROM public.profile_completion_reminders WHERE (status='pending' OR (status='processing' AND dispatch_started_at IS NULL AND updated_at<now()-interval '10 minutes')) AND due_at<=now() ORDER BY due_at,id LIMIT 20 FOR UPDATE SKIP LOCKED) RETURNING *; END $$;
REVOKE ALL ON FUNCTION public.profile_reminder_claim() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.profile_reminder_claim() TO service_role;
CREATE FUNCTION public.profile_reminder_pause_if_drained() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
-- Serialise pause with enqueue so a concurrent dismissal cannot lose its wake-up.
LOCK TABLE public.profile_completion_reminders IN SHARE ROW EXCLUSIVE MODE;
IF NOT EXISTS(SELECT 1 FROM public.profile_completion_reminders WHERE status IN ('pending','processing')) THEN PERFORM cron.alter_job(341,active:=false); END IF; END $$;
REVOKE ALL ON FUNCTION public.profile_reminder_pause_if_drained() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.profile_reminder_pause_if_drained() TO service_role;