ALTER TABLE public.admin_campaign_recipients ADD COLUMN IF NOT EXISTS retry_after timestamptz;

CREATE OR REPLACE FUNCTION public.admin_campaign_claim(_limit integer)
 RETURNS TABLE(id uuid, campaign_id uuid, user_id uuid, channel text, attempts integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN
UPDATE public.admin_campaign_recipients r SET status='skipped',error_code='delivery_unknown',updated_at=now() WHERE r.status='processing' AND r.dispatch_started_at IS NOT NULL AND r.updated_at<now()-interval '10 minutes';
RETURN QUERY WITH picked AS (SELECT r.id FROM public.admin_campaign_recipients r JOIN public.admin_campaigns c ON c.id=r.campaign_id AND c.status IN ('queued','sending') WHERE (r.status='pending' AND (r.retry_after IS NULL OR r.retry_after<=now())) OR (r.status='processing' AND r.dispatch_started_at IS NULL AND r.updated_at<now()-interval '10 minutes') ORDER BY c.created_at,r.id LIMIT greatest(1,least(_limit,100)) FOR UPDATE OF r SKIP LOCKED) UPDATE public.admin_campaign_recipients r SET status='processing',attempts=r.attempts+1,updated_at=now() FROM picked WHERE r.id=picked.id RETURNING r.id,r.campaign_id,r.user_id,r.channel,r.attempts;
UPDATE public.admin_campaigns c SET status='sending' WHERE c.status='queued' AND EXISTS (SELECT 1 FROM public.admin_campaign_recipients r WHERE r.campaign_id=c.id AND r.status='processing');
PERFORM public.admin_campaign_refresh(c.id) FROM public.admin_campaigns c WHERE c.status IN ('queued','sending'); END $function$;

-- 429 means Resend never accepted these emails: safely re-queue them (same idempotency key).
WITH fixed AS (
  UPDATE public.admin_campaign_recipients SET status='pending', error_code='email_rate_limited', dispatch_started_at=NULL, retry_after=NULL, attempts=0, updated_at=now()
  WHERE channel='email' AND status='failed' AND error_code='email_rejected_429' RETURNING campaign_id)
UPDATE public.admin_campaigns c SET status='sending', completed_at=NULL WHERE c.id IN (SELECT campaign_id FROM fixed) AND c.status IN ('completed','sending','queued');

SELECT public.admin_campaign_refresh(id) FROM public.admin_campaigns WHERE status='sending';