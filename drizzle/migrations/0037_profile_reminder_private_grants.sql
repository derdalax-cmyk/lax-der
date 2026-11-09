REVOKE ALL ON public.profile_completion_reminders FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.profile_completion_reminders TO service_role;