CREATE OR REPLACE FUNCTION public.set_collaborator_role(_id uuid, _role_slug text, _permissions text[] DEFAULT NULL::text[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _perms text[]; _row public.seller_collaborators; _had_feature boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT 'products.feature' = ANY(permissions) INTO _had_feature FROM public.seller_collaborators WHERE id = _id;
  IF NOT EXISTS (SELECT 1 FROM public.collaborator_roles WHERE slug = _role_slug) THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF _permissions IS NULL THEN
    SELECT default_permissions INTO _perms FROM public.collaborator_roles WHERE slug = _role_slug;
    IF COALESCE(_had_feature,false) AND NOT ('products.feature' = ANY(_perms)) THEN
      _perms := _perms || 'products.feature'::text;
    END IF;
  ELSE
    SELECT array_agg(DISTINCT p) INTO _perms FROM unnest(_permissions) p;
    _perms := COALESCE(_perms, '{}'::text[]);
  END IF;
  UPDATE public.seller_collaborators SET role_slug = _role_slug, permissions = _perms, updated_at = now()
    WHERE id = _id RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), _row.seller_id, 'collaborator', _row.id,
          'collaborator.role', jsonb_build_object('role', _role_slug, 'permissions', _perms));
END; $function$;

CREATE OR REPLACE FUNCTION public.withdraw_product_from_collection(_collection_id uuid, _product_id uuid, _seller_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF _seller_id IS NULL OR NOT COALESCE(public.can_feature_for_seller(_seller_id), false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id AND seller_id = _seller_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.featured_collection_products
   WHERE collection_id = _collection_id AND product_id = _product_id AND seller_id = _seller_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.move_product_featured_collection(_from_collection_id uuid, _to_collection_id uuid, _product_id uuid, _seller_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF _seller_id IS NULL OR NOT COALESCE(public.can_feature_for_seller(_seller_id), false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id AND seller_id = _seller_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _from_collection_id = _to_collection_id THEN RETURN; END IF;
  DELETE FROM public.featured_collection_products
   WHERE collection_id = _from_collection_id AND product_id = _product_id AND seller_id = _seller_id;
  -- Nova associação segue as regras normais (limites, hidden_sellers, datas, aprovação)
  PERFORM public.submit_products_to_collection(_to_collection_id, ARRAY[_product_id], _seller_id);
END; $function$;

GRANT EXECUTE ON FUNCTION public.move_product_featured_collection(uuid, uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Sellers withdraw own pending submissions" ON public.featured_collection_products;
CREATE POLICY "Sellers withdraw own submissions" ON public.featured_collection_products
  FOR DELETE TO authenticated
  USING (public.can_feature_for_seller(seller_id) AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = featured_collection_products.seller_id));

CREATE OR REPLACE FUNCTION public.get_seller_featured_collections(_seller_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _seller uuid := COALESCE(_seller_id, public.current_seller_id()); _res jsonb;
BEGIN
  IF _seller IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT COALESCE(public.can_feature_for_seller(_seller), false) THEN RETURN '[]'::jsonb; END IF;
  SELECT coalesce(jsonb_agg(row ORDER BY (row->>'sort_order')::int), '[]'::jsonb) INTO _res
  FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'name', c.name, 'icon', c.icon, 'cover_image', c.cover_image,
      'max_products_per_seller', c.max_products_per_seller,
      'starts_at', c.starts_at, 'ends_at', c.ends_at, 'sort_order', c.sort_order,
      'submissions', (
        SELECT coalesce(jsonb_agg(jsonb_build_object('product_id', fcp.product_id, 'status', fcp.status)), '[]'::jsonb)
        FROM featured_collection_products fcp
        JOIN products p ON p.id = fcp.product_id
        WHERE fcp.collection_id = c.id AND p.seller_id = _seller
      )
    ) AS row
    FROM featured_collections c
    WHERE c.is_active = true AND NOT (_seller = ANY(c.hidden_sellers))
      AND (c.starts_at IS NULL OR c.starts_at <= now())
      AND (c.ends_at IS NULL OR c.ends_at >= now())
  ) t;
  RETURN _res;
END; $function$;