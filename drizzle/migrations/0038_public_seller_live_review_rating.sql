CREATE OR REPLACE FUNCTION public.get_public_seller(_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', s.id,
    'store_name', s.store_name,
    'logo_url', s.logo_url,
    'city', s.city,
    'province', s.province,
    'description', s.description,
    'rating', COALESCE(r.rating, 0),
    'total_reviews', r.total_reviews,
    'created_at', s.created_at,
    'product_count', (SELECT count(*) FROM public.products p WHERE p.seller_id = s.id AND p.approval_status = 'approved' AND p.status <> 'sold')
  )
  FROM public.sellers s
  CROSS JOIN LATERAL (
    SELECT avg(sr.rating)::numeric AS rating, count(*) AS total_reviews
    FROM public.seller_reviews sr
    WHERE sr.seller_id = s.id AND sr.rating BETWEEN 1 AND 5
  ) r
  WHERE s.id = _id AND s.status = 'approved';
$function$;
COMMENT ON FUNCTION public.get_public_seller(uuid) IS 'Public store summary: rating and total_reviews are read directly from valid seller_reviews, never sellers cached counters. Existing approved-store visibility and review permissions are unchanged.';