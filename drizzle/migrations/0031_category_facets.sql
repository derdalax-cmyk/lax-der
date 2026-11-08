CREATE OR REPLACE FUNCTION public.get_explore_facets()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pub AS (SELECT * FROM public.products WHERE approval_status = 'approved' AND status <> 'sold'),
  words AS (SELECT lower(split_part(btrim(title), ' ', 1)) w1, lower(split_part(btrim(title), ' ', 2)) w2 FROM pub)
  SELECT jsonb_build_object(
    'sizes', coalesce((SELECT jsonb_agg(s ORDER BY n DESC, s) FROM (SELECT meta_size s, count(*) n FROM pub WHERE meta_size IS NOT NULL AND length(meta_size) <= 6 GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x), '[]'),
    'colors', coalesce((SELECT jsonb_agg(c ORDER BY n DESC, c) FROM (SELECT meta_color c, count(*) n FROM pub WHERE meta_color IS NOT NULL AND length(meta_color) <= 20 GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x), '[]'),
    'sellers', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.store_name) ORDER BY s.store_name) FROM public.sellers s WHERE s.status = 'approved' AND NOT s.is_blocked AND EXISTS (SELECT 1 FROM pub WHERE pub.seller_id = s.id)), '[]'),
    'price_max', coalesce((SELECT max(base_price) FROM pub), 0),
    'suggestions', coalesce((SELECT jsonb_agg(t) FROM (SELECT initcap(w1) || CASE WHEN w2 ~ '^[a-zà-ú]{3,}$' AND w2 NOT IN ('com','para','sem','das','dos','manga') THEN ' ' || w2 ELSE '' END t, count(*) n FROM words WHERE w1 ~ '^[a-zà-ú]{3,}$' GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 12) z), '[]'),
    'categories', coalesce((SELECT jsonb_object_agg(category, n) FROM (SELECT category, count(*) n FROM pub WHERE category IS NOT NULL GROUP BY 1) x), '{}')
  )
$$;