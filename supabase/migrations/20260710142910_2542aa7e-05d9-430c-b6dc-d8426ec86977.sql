CREATE OR REPLACE FUNCTION public.get_available_cities()
 RETURNS TABLE(city text, product_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.city, count(*)::bigint
  FROM public.products p
  JOIN public.sellers s ON s.id = p.seller_id AND s.status = 'approved' AND s.is_blocked = false
  WHERE p.city IS NOT NULL
    AND p.approval_status = 'approved'
    AND p.status <> 'sold'
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.product_variations v
        WHERE v.product_id = p.id AND v.is_active
      )
      OR EXISTS (
        SELECT 1 FROM public.product_variations v
        WHERE v.product_id = p.id AND v.is_active AND v.stock > 0
      )
    )
  GROUP BY p.city
  ORDER BY count(*) DESC;
$function$;