GRANT EXECUTE ON FUNCTION public.has_seller_permission(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.current_seller_id() TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;