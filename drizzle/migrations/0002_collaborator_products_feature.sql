CREATE OR REPLACE FUNCTION public.can_feature_for_seller(_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _seller_id IS NOT NULL AND (
    public.current_seller_id() = _seller_id
    OR public.has_seller_permission(_seller_id, 'products.feature')
  );
$$;

REVOKE ALL ON FUNCTION public.can_feature_for_seller(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_feature_for_seller(uuid) TO authenticated;

DROP POLICY IF EXISTS "Sellers submit own products to active collections" ON public.featured_collection_products;
CREATE POLICY "Sellers submit own products to active collections"
ON public.featured_collection_products FOR INSERT TO authenticated
WITH CHECK (
  public.can_feature_for_seller(seller_id)
  AND status = 'pending'
  AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.seller_id = featured_collection_products.seller_id)
  AND EXISTS (
    SELECT 1 FROM featured_collections c
     WHERE c.id = collection_id AND c.is_active = true
       AND NOT (featured_collection_products.seller_id = ANY (c.hidden_sellers))
       AND (c.starts_at IS NULL OR c.starts_at <= now())
       AND (c.ends_at IS NULL OR c.ends_at >= now())
  )
);

DROP POLICY IF EXISTS "Sellers withdraw own pending submissions" ON public.featured_collection_products;
CREATE POLICY "Sellers withdraw own pending submissions"
ON public.featured_collection_products FOR DELETE TO authenticated
USING (public.can_feature_for_seller(seller_id) AND status <> 'approved');

DROP POLICY IF EXISTS fcp_select_scoped ON public.featured_collection_products;
CREATE POLICY fcp_select_scoped
ON public.featured_collection_products FOR SELECT TO anon, authenticated
USING (
  status = 'approved'
  OR (seller_id IS NOT NULL AND seller_id = public.current_seller_id())
  OR (submitted_by IS NOT NULL AND submitted_by = public.current_seller_id())
  OR (seller_id IS NOT NULL AND public.has_seller_permission(seller_id, 'products.feature'))
  OR public.has_role(auth.uid(), 'admin')
);

DROP FUNCTION IF EXISTS public.submit_products_to_collection(uuid, uuid[]);
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
  IF NOT public.can_feature_for_seller(_seller) THEN RAISE EXCEPTION 'forbidden'; END IF;

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

REVOKE ALL ON FUNCTION public.submit_products_to_collection(uuid, uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_products_to_collection(uuid, uuid[], uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.withdraw_product_from_collection(uuid, uuid);
CREATE OR REPLACE FUNCTION public.withdraw_product_from_collection(
  _collection_id uuid, _product_id uuid, _seller_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_feature_for_seller(_seller_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.featured_collection_products
   WHERE collection_id = _collection_id
     AND product_id = _product_id
     AND seller_id = _seller_id
     AND status <> 'approved';
END; $$;

REVOKE ALL ON FUNCTION public.withdraw_product_from_collection(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_product_from_collection(uuid, uuid, uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.get_seller_featured_collections();
CREATE OR REPLACE FUNCTION public.get_seller_featured_collections(_seller_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _seller uuid := COALESCE(_seller_id, public.current_seller_id()); _res jsonb;
BEGIN
  IF _seller IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT public.can_feature_for_seller(_seller) THEN RETURN '[]'::jsonb; END IF;

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

REVOKE ALL ON FUNCTION public.get_seller_featured_collections(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_featured_collections(uuid) TO authenticated;