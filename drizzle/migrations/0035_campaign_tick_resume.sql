-- lovable-cron-fallback-reviewed: re-arms the existing wake-on-enqueue campaign queue worker for re-queued rows; it unschedules itself after drain.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_campaign_recipients WHERE status='pending') THEN
    PERFORM cron.schedule('admin-campaign-tick','* * * * *','SELECT public.admin_campaign_tick()');
  END IF;
END $$;