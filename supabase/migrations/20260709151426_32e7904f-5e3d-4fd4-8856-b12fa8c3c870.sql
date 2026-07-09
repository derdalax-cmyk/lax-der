
-- Extend featured_collections
ALTER TABLE public.featured_collections
  ADD COLUMN IF NOT EXISTS cover_image text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_products_per_seller integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hidden_sellers uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Extend featured_collection_products with moderation status
ALTER TABLE public.featured_collection_products
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fcp_status_check') THEN
    ALTER TABLE public.featured_collection_products
      ADD CONSTRAINT fcp_status_check CHECK (status IN ('pending','approved','rejected'));
  END IF;
END $$;

-- Seller: submit own products to an available collection (as pending)
CREATE OR REPLACE FUNCTION public.submit_products_to_collection(_collection_id uuid, _product_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seller uuid := public.current_seller_id();
  _max int;
  _hidden uuid[];
  _active boolean;
  _existing int;
  _pid uuid;
BEGIN
  IF _seller IS NULL THEN RAISE EXCEPTION 'Não é vendedor aprovado'; END IF;
  SELECT max_products_per_seller, hidden_sellers, is_active
    INTO _max, _hidden, _active
    FROM featured_collections WHERE id = _collection_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destaque não existe'; END IF;
  IF NOT _active THEN RAISE EXCEPTION 'Destaque indisponível'; END IF;
  IF _seller = ANY(_hidden) THEN RAISE EXCEPTION 'Sem permissão para este destaque'; END IF;

  SELECT count(*) INTO _existing
    FROM featured_collection_products fcp
    JOIN products p ON p.id = fcp.product_id
    WHERE fcp.collection_id = _collection_id
      AND p.seller_id = _seller
      AND fcp.status <> 'rejected';

  FOREACH _pid IN ARRAY _product_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = _pid AND seller_id = _seller) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM featured_collection_products WHERE collection_id = _collection_id AND product_id = _pid) THEN CONTINUE; END IF;
    IF _max > 0 AND _existing >= _max THEN
      RAISE EXCEPTION 'Limite de % produto(s) por vendedor atingido neste destaque', _max;
    END IF;
    INSERT INTO featured_collection_products (collection_id, product_id, sort_order, status, submitted_by)
      VALUES (_collection_id, _pid, 9999, 'pending', _seller);
    _existing := _existing + 1;
  END LOOP;
END;
$$;

-- Seller: withdraw own submission
CREATE OR REPLACE FUNCTION public.withdraw_product_from_collection(_collection_id uuid, _product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _seller uuid := public.current_seller_id();
BEGIN
  IF _seller IS NULL THEN RAISE EXCEPTION 'Não é vendedor aprovado'; END IF;
  DELETE FROM featured_collection_products fcp
   USING products p
   WHERE fcp.product_id = p.id
     AND fcp.collection_id = _collection_id
     AND fcp.product_id = _product_id
     AND p.seller_id = _seller;
END;
$$;

-- Seller: available collections with own submission status
CREATE OR REPLACE FUNCTION public.get_seller_featured_collections()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _seller uuid := public.current_seller_id(); _res jsonb;
BEGIN
  IF _seller IS NULL THEN RETURN '[]'::jsonb; END IF;
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_products_to_collection(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_product_from_collection(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_featured_collections() TO authenticated;
