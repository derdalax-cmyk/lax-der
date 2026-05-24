
-- 1. Restrict waiting_list SELECT to owners + admins (was public)
DROP POLICY IF EXISTS "Anyone view waiting list" ON public.waiting_list;

CREATE POLICY "Users view own waiting list"
ON public.waiting_list
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all waiting list"
ON public.waiting_list
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Lock down SECURITY DEFINER functions that should not be public
-- Internal/admin-only functions: revoke from anon AND authenticated
REVOKE EXECUTE ON FUNCTION public.grant_admin_by_email(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.revoke_admin_by_email(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.release_expired_reservations() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.promote_next_in_queue(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;

-- User-callable functions: keep authenticated, revoke anon
REVOKE EXECUTE ON FUNCTION public.reserve_product(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.release_product(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.finalize_order_items(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reserve_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order_items(uuid) TO authenticated;

-- has_role is used in RLS policies; keep it callable by both roles (needed for policy evaluation)
-- No change to has_role
