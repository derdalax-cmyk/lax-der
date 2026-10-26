REVOKE INSERT ON public.orders, public.order_items, public.order_sellers FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
DROP POLICY IF EXISTS "Users insert order items for own orders" ON public.order_items;
REVOKE EXECUTE ON FUNCTION public.create_order_secure(jsonb,text,text,jsonb,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_secure(jsonb,text,text,jsonb,text,text,text,text) TO authenticated, service_role;

-- Column grants prevent direct Data API requests from bypassing the projection.
REVOKE SELECT ON public.products FROM PUBLIC, anon, authenticated;
REVOKE SELECT (reserved_by, rejection_reason, stock_alert) ON public.products FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,title,description,base_price,category,images,is_unique,featured,status,reserved_until,created_at,updated_at,seller_id,approval_status,city,shipping_fee,stock,original_price) ON public.products TO anon, authenticated;
CREATE OR REPLACE VIEW public.public_products WITH (security_invoker = true, security_barrier = true) AS
SELECT id,title,description,base_price,category,images,is_unique,featured,status,reserved_until,created_at,updated_at,seller_id,approval_status,city,shipping_fee,stock,original_price
FROM public.products WHERE approval_status = 'approved' AND status <> 'sold';
GRANT SELECT ON public.public_products TO anon, authenticated;
GRANT ALL ON public.public_products TO service_role;
COMMENT ON VIEW public.public_products IS 'Explicit storefront projection; RLS applies to the caller; excludes reservation identity and private moderation fields.';

CREATE OR REPLACE FUNCTION public.get_my_product_reservations(_product_ids uuid[])
RETURNS TABLE(product_id uuid, reserved_by_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT p.id, COALESCE(p.reserved_by = auth.uid(), false)
FROM public.products p WHERE auth.uid() IS NOT NULL AND p.id = ANY(_product_ids)
AND p.approval_status = 'approved' AND p.status <> 'sold' $$;
REVOKE ALL ON FUNCTION public.get_my_product_reservations(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_product_reservations(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_managed_products(_seller_id uuid DEFAULT NULL)
RETURNS SETOF public.products
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT p.* FROM public.products p
WHERE auth.uid() IS NOT NULL AND (_seller_id IS NULL OR p.seller_id = _seller_id)
AND (public.has_role(auth.uid(), 'admin') OR p.seller_id = public.current_seller_id()
OR public.has_seller_permission(p.seller_id, 'products.view'))
ORDER BY p.created_at DESC, p.id DESC $$;
REVOKE ALL ON FUNCTION public.get_managed_products(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_managed_products(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.get_managed_products(uuid) IS 'Private full product records, scoped to admin, seller owner or active collaborator with products.view.';