CREATE OR REPLACE FUNCTION public.product_meta_field(_description text, _key text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE m text;
BEGIN
  m := substring(_description from '<!--META:(\{.*?\})-->');
  IF m IS NULL THEN RETURN NULL; END IF;
  RETURN nullif(btrim(m::jsonb ->> _key), '');
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS meta_gender text GENERATED ALWAYS AS (lower(public.product_meta_field(description, 'gender'))) STORED,
  ADD COLUMN IF NOT EXISTS meta_color text GENERATED ALWAYS AS (lower(public.product_meta_field(description, 'color'))) STORED,
  ADD COLUMN IF NOT EXISTS meta_size text GENERATED ALWAYS AS (upper(public.product_meta_field(description, 'default_size'))) STORED;

CREATE INDEX IF NOT EXISTS products_public_feed_idx ON public.products (created_at DESC, id DESC) WHERE approval_status = 'approved' AND status <> 'sold';
CREATE INDEX IF NOT EXISTS products_public_category_idx ON public.products (category, created_at DESC) WHERE approval_status = 'approved' AND status <> 'sold';
CREATE INDEX IF NOT EXISTS products_public_gender_idx ON public.products (meta_gender, created_at DESC) WHERE approval_status = 'approved' AND status <> 'sold';
CREATE INDEX IF NOT EXISTS products_public_seller_idx ON public.products (seller_id, created_at DESC) WHERE approval_status = 'approved' AND status <> 'sold';
CREATE INDEX IF NOT EXISTS products_public_price_idx ON public.products (base_price) WHERE approval_status = 'approved' AND status <> 'sold';

CREATE OR REPLACE FUNCTION public.explore_products(
  _q text DEFAULT NULL, _categories text[] DEFAULT NULL, _gender text DEFAULT NULL,
  _min numeric DEFAULT NULL, _max numeric DEFAULT NULL, _discount boolean DEFAULT false,
  _available boolean DEFAULT false, _unique boolean DEFAULT false,
  _sizes text[] DEFAULT NULL, _colors text[] DEFAULT NULL, _seller uuid DEFAULT NULL,
  _city text DEFAULT NULL, _cursor_created timestamptz DEFAULT NULL, _cursor_id uuid DEFAULT NULL,
  _limit integer DEFAULT 40)
RETURNS TABLE(id uuid, title text, base_price numeric, original_price numeric, images jsonb, is_unique boolean, status product_status, category text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.id, p.title, p.base_price, p.original_price, p.images, p.is_unique, p.status, p.category, p.created_at
  FROM public.products p
  WHERE p.approval_status = 'approved' AND p.status <> 'sold'
    AND (_q IS NULL OR _q = '' OR p.title ILIKE '%' || _q || '%')
    AND (_categories IS NULL OR cardinality(_categories) = 0 OR p.category = ANY(_categories))
    AND (_gender IS NULL OR _gender = '' OR p.meta_gender = lower(_gender))
    AND (_min IS NULL OR p.base_price >= _min)
    AND (_max IS NULL OR p.base_price <= _max)
    AND (NOT _discount OR (p.original_price IS NOT NULL AND p.original_price > p.base_price))
    AND (NOT _available OR p.status = 'available')
    AND (NOT _unique OR p.is_unique)
    AND (_sizes IS NULL OR cardinality(_sizes) = 0 OR p.meta_size = ANY(_sizes))
    AND (_colors IS NULL OR cardinality(_colors) = 0 OR p.meta_color = ANY(_colors))
    AND (_seller IS NULL OR p.seller_id = _seller)
    AND (_city IS NULL OR p.city = _city OR p.city IS NULL)
    AND (_cursor_created IS NULL OR p.created_at < _cursor_created OR (p.created_at = _cursor_created AND p.id < _cursor_id))
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT least(greatest(coalesce(_limit, 40), 1), 100)
$$;

CREATE OR REPLACE FUNCTION public.explore_products_count(
  _q text DEFAULT NULL, _categories text[] DEFAULT NULL, _gender text DEFAULT NULL,
  _min numeric DEFAULT NULL, _max numeric DEFAULT NULL, _discount boolean DEFAULT false,
  _available boolean DEFAULT false, _unique boolean DEFAULT false,
  _sizes text[] DEFAULT NULL, _colors text[] DEFAULT NULL, _seller uuid DEFAULT NULL, _city text DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT count(*)::int FROM (SELECT 1 FROM public.products p
  WHERE p.approval_status = 'approved' AND p.status <> 'sold'
    AND (_q IS NULL OR _q = '' OR p.title ILIKE '%' || _q || '%')
    AND (_categories IS NULL OR cardinality(_categories) = 0 OR p.category = ANY(_categories))
    AND (_gender IS NULL OR _gender = '' OR p.meta_gender = lower(_gender))
    AND (_min IS NULL OR p.base_price >= _min)
    AND (_max IS NULL OR p.base_price <= _max)
    AND (NOT _discount OR (p.original_price IS NOT NULL AND p.original_price > p.base_price))
    AND (NOT _available OR p.status = 'available')
    AND (NOT _unique OR p.is_unique)
    AND (_sizes IS NULL OR cardinality(_sizes) = 0 OR p.meta_size = ANY(_sizes))
    AND (_colors IS NULL OR cardinality(_colors) = 0 OR p.meta_color = ANY(_colors))
    AND (_seller IS NULL OR p.seller_id = _seller)
    AND (_city IS NULL OR p.city = _city OR p.city IS NULL)
  LIMIT 10000) s
$$;

CREATE OR REPLACE FUNCTION public.get_explore_facets()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pub AS (SELECT * FROM public.products WHERE approval_status = 'approved' AND status <> 'sold')
  SELECT jsonb_build_object(
    'sizes', coalesce((SELECT jsonb_agg(s ORDER BY n DESC, s) FROM (SELECT meta_size s, count(*) n FROM pub WHERE meta_size IS NOT NULL AND length(meta_size) <= 6 GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x), '[]'),
    'colors', coalesce((SELECT jsonb_agg(c ORDER BY n DESC, c) FROM (SELECT meta_color c, count(*) n FROM pub WHERE meta_color IS NOT NULL AND length(meta_color) <= 20 GROUP BY 1 HAVING count(*) >= 1 ORDER BY 2 DESC LIMIT 20) x), '[]'),
    'sellers', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.store_name) ORDER BY s.store_name) FROM public.sellers s WHERE s.status = 'approved' AND NOT s.is_blocked AND EXISTS (SELECT 1 FROM pub WHERE pub.seller_id = s.id)), '[]'),
    'price_max', coalesce((SELECT max(base_price) FROM pub), 0),
    'suggestions', coalesce((SELECT jsonb_agg(t) FROM (SELECT t FROM (SELECT initcap(lower(split_part(btrim(title), ' ', 1))) || coalesce(' ' || nullif(lower(split_part(btrim(title), ' ', 2)), ''), '') t, count(*) n FROM pub WHERE length(btrim(title)) > 2 GROUP BY 1) y WHERE length(t) BETWEEN 4 AND 28 ORDER BY n DESC, t LIMIT 12) z), '[]')
  )
$$;

GRANT EXECUTE ON FUNCTION public.explore_products(text, text[], text, numeric, numeric, boolean, boolean, boolean, text[], text[], uuid, text, timestamptz, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.explore_products_count(text, text[], text, numeric, numeric, boolean, boolean, boolean, text[], text[], uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_explore_facets() TO anon, authenticated;