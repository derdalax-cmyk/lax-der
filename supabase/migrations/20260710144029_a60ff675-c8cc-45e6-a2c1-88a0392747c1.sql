-- Allow guests (anon) to evaluate RLS policies that call has_role().
-- Several tables (products, product_variations, orders, order_items, waiting_list, user_roles)
-- have admin policies defined for the public role (which includes anon) whose USING clause
-- calls public.has_role(). Because anon lacked EXECUTE on has_role, ALL anonymous reads on
-- those tables failed with "permission denied for function has_role", making products
-- invisible to logged-out visitors. has_role is SECURITY DEFINER and only returns a boolean;
-- for an anonymous user auth.uid() is null so it safely returns false.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;