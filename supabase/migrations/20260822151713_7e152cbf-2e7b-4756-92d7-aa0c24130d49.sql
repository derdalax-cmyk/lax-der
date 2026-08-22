-- Fix mutable search_path on email queue helpers
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- Revoke public/client execute privileges on internal-only functions
REVOKE ALL ON FUNCTION public.notify_push(uuid, text, text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.notify_email(uuid, text, text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;

-- Keep service_role (server routes / cron) able to execute
GRANT EXECUTE ON FUNCTION public.notify_push(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_email(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;