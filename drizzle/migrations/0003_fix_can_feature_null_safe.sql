CREATE OR REPLACE FUNCTION public.can_feature_for_seller(_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    _seller_id IS NOT NULL AND (
      COALESCE(public.current_seller_id() = _seller_id, false)
      OR COALESCE(public.has_seller_permission(_seller_id, 'products.feature'), false)
    ), false);
$$;

CREATE OR REPLACE FUNCTION public.submit_products_to_collection(
  _collection_id uuid, _product_ids uuid[], _seller_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _seller uuid := _seller_id;
  _max int; _hidden uuid[]; _active boolean; _starts timestamptz; _ends timestamptz;
  _existing int; _pid uuid;
BEGIN
  IF _seller IS NULL OR NOT COALESCE(public.can_feature_for_seller(_seller), false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT max_products_per_seller, hidden_sellers, is_active, starts_at, ends_at
    INTO _max, _hidden, _active, _starts, _ends
    FROM featured_collections WHERE id = _collection_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Destaque não existe'; END IF;
  IF NOT _active OR (_starts IS NOT NULL AND _starts > now()) OR (_ends IS NOT NULL AND _ends < now()) THEN
    RAISE EXCEPTION 'Destaque indisponível';
  END IF;
  IF _seller = ANY(_hidden) THEN RAISE EXCEPTION 'Sem permissão para este destaque'; END IF;

  SELECT count(*) INTO _existing FROM featured_collection_products
   WHERE collection_id = _collection_id AND seller_id = _seller AND status <> 'rejected';

  FOREACH _pid IN ARRAY _product_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = _pid AND seller_id = _seller) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM featured_collection_products
                WHERE collection_id = _collection_id AND product_id = _pid) THEN CONTINUE; END IF;
    IF _max > 0 AND _existing >= _max THEN
      RAISE EXCEPTION 'Limite de % produto(s) por vendedor atingido neste destaque', _max;
    END IF;

    INSERT INTO featured_collection_products
      (collection_id, product_id, seller_id, sort_order, status, submitted_by)
    VALUES (_collection_id, _pid, _seller, 9999, 'pending', _seller);

    _existing := _existing + 1;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.withdraw_product_from_collection(
  _collection_id uuid, _product_id uuid, _seller_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _seller_id IS NULL OR NOT COALESCE(public.can_feature_for_seller(_seller_id), false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.featured_collection_products
   WHERE collection_id = _collection_id
     AND product_id = _product_id
     AND seller_id = _seller_id
     AND status <> 'approved';
END; $$;

CREATE OR REPLACE FUNCTION public.get_seller_featured_collections(_seller_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _seller uuid := COALESCE(_seller_id, public.current_seller_id()); _res jsonb;
BEGIN
  IF _seller IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT COALESCE(public.can_feature_for_seller(_seller), false) THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(row ORDER BY (row->>'sort_order')::int), '[]'::jsonb) INTO _res
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'icon', c.icon,
      'cover_image', c.cover_image,
      'max_products_per_seller', c.max_products_per_seller,
      'starts_at', c.starts_at,
      'ends_at', c.ends_at,
      'sort_order', c.sort_order,
      'submissions', (
        SELECT coalesce(jsonb_agg(jsonb_build_object('product_id', fcp.product_id, 'status', fcp.status)), '[]'::jsonb)
        FROM featured_collection_products fcp
        JOIN products p ON p.id = fcp.product_id
        WHERE fcp.collection_id = c.id AND p.seller_id = _seller
      )
    ) AS row
    FROM featured_collections c
    WHERE c.is_active = true AND NOT (_seller = ANY(c.hidden_sellers))
  ) t;
  RETURN _res;
END; $$;