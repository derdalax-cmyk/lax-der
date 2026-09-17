CREATE OR REPLACE FUNCTION public.log_product_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _email text;
  _name text;
  _changes jsonb := '{}'::jsonb;
  _is_collab boolean;
BEGIN
  IF auth.uid() IS NULL OR NEW.seller_id IS NULL THEN RETURN NEW; END IF;

  -- Registar apenas ações feitas por colaboradores da loja (não o dono nem admin)
  SELECT EXISTS (
    SELECT 1 FROM public.seller_collaborators sc
    WHERE sc.user_id = auth.uid()
      AND sc.seller_id = NEW.seller_id
      AND sc.status = 'active'
  ) INTO _is_collab;

  IF NOT _is_collab THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = NEW.seller_id AND s.user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT email, name INTO _email, _name FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
    VALUES (auth.uid(), _email, NEW.seller_id, 'product', NEW.id, 'product.create',
            jsonb_build_object('title', NEW.title, 'base_price', NEW.base_price, 'stock', NEW.stock,
                               'product_title', NEW.title, 'actor_name', _name));
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN
    _changes := _changes || jsonb_build_object('title', jsonb_build_object('from', OLD.title, 'to', NEW.title));
  END IF;
  IF NEW.base_price IS DISTINCT FROM OLD.base_price THEN
    _changes := _changes || jsonb_build_object('base_price', jsonb_build_object('from', OLD.base_price, 'to', NEW.base_price));
  END IF;
  IF NEW.stock IS DISTINCT FROM OLD.stock THEN
    _changes := _changes || jsonb_build_object('stock', jsonb_build_object('from', OLD.stock, 'to', NEW.stock));
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _changes := _changes || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    _changes := _changes || jsonb_build_object('description', 'alterada');
  END IF;
  IF NEW.images IS DISTINCT FROM OLD.images THEN
    _changes := _changes || jsonb_build_object('images', 'alteradas');
  END IF;

  IF _changes <> '{}'::jsonb THEN
    INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
    VALUES (auth.uid(), _email, NEW.seller_id, 'product', NEW.id, 'product.update',
            _changes || jsonb_build_object('product_title', NEW.title, 'actor_name', _name));
  END IF;
  RETURN NEW;
END;
$function$;

-- Leitura da auditoria por loja: admin ou dono da loja (nunca o colaborador)
CREATE OR REPLACE FUNCTION public.get_seller_audit_logs(_seller_id uuid, _limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _res jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.current_seller_id() = _seller_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb) INTO _res
  FROM (
    SELECT jsonb_build_object(
      'id', al.id,
      'actor_id', al.actor_id,
      'actor_email', al.actor_email,
      'actor_name', COALESCE(p.name, al.changes->>'actor_name'),
      'seller_id', al.seller_id,
      'product_id', al.entity_id,
      'product_title', COALESCE(pr.title, al.changes->>'product_title'),
      'action', al.action,
      'changes', al.changes,
      'created_at', al.created_at
    ) AS x
    FROM public.activity_logs al
    LEFT JOIN public.profiles p ON p.id = al.actor_id
    LEFT JOIN public.products pr ON pr.id = al.entity_id
    WHERE al.seller_id = _seller_id
    ORDER BY al.created_at DESC
    LIMIT COALESCE(_limit, 100)
  ) t;

  RETURN _res;
END;
$$;

REVOKE ALL ON FUNCTION public.get_seller_audit_logs(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_audit_logs(uuid, integer) TO authenticated;
