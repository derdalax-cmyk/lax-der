-- ============ roles catalogue ============
CREATE TABLE public.collaborator_roles (
  slug text PRIMARY KEY,
  label text NOT NULL,
  description text,
  default_permissions text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collaborator_roles TO authenticated;
GRANT ALL ON public.collaborator_roles TO service_role;
ALTER TABLE public.collaborator_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read roles" ON public.collaborator_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.collaborator_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.collaborator_roles (slug, label, description, default_permissions, sort_order) VALUES
  ('product_manager', 'Gestor de Cadastro de Produtos',
   'Cadastra e edita produtos da loja atribuída. Sem acesso a pedidos, vendas ou pagamentos.',
   ARRAY['products.view','products.create','products.update','seller.view_basic'], 1);

-- ============ collaborator status ============
DO $$ BEGIN
  CREATE TYPE public.collaborator_status AS ENUM ('active','suspended','removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.seller_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  role_slug text NOT NULL REFERENCES public.collaborator_roles(slug),
  permissions text[] NOT NULL DEFAULT '{}',
  status public.collaborator_status NOT NULL DEFAULT 'active',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, seller_id)
);
CREATE INDEX seller_collaborators_user_idx ON public.seller_collaborators (user_id) WHERE status = 'active';
CREATE INDEX seller_collaborators_seller_idx ON public.seller_collaborators (seller_id);

GRANT SELECT ON public.seller_collaborators TO authenticated;
GRANT ALL ON public.seller_collaborators TO service_role;
ALTER TABLE public.seller_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collaborators view own assignments" ON public.seller_collaborators
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Store owner views own collaborators" ON public.seller_collaborators
  FOR SELECT TO authenticated USING (seller_id = public.current_seller_id());
CREATE POLICY "Admins manage collaborators" ON public.seller_collaborators
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER seller_collaborators_updated_at BEFORE UPDATE ON public.seller_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ activity log ============
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  seller_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_seller_idx ON public.activity_logs (seller_id, created_at DESC);
CREATE INDEX activity_logs_actor_idx ON public.activity_logs (actor_id, created_at DESC);

GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Store owner reads own activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (seller_id IS NOT NULL AND seller_id = public.current_seller_id());

-- ============ permission helper ============
CREATE OR REPLACE FUNCTION public.has_seller_permission(_seller_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _seller_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.seller_collaborators sc
    JOIN public.sellers s ON s.id = sc.seller_id
    WHERE sc.user_id = auth.uid()
      AND sc.seller_id = _seller_id
      AND sc.status = 'active'
      AND _perm = ANY (sc.permissions)
      AND s.status = 'approved'
      AND s.is_blocked = false
  );
$$;
REVOKE ALL ON FUNCTION public.has_seller_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_seller_permission(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_collaborations()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'store_name'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'seller_id', s.id,
      'store_name', s.store_name,
      'logo_url', s.logo_url,
      'city', s.city,
      'province', s.province,
      'role_slug', sc.role_slug,
      'role_label', r.label,
      'permissions', sc.permissions,
      'status', sc.status,
      'total_products', (SELECT count(*) FROM public.products p WHERE p.seller_id = s.id),
      'pending_products', (SELECT count(*) FROM public.products p WHERE p.seller_id = s.id AND p.approval_status = 'pending'),
      'approved_products', (SELECT count(*) FROM public.products p WHERE p.seller_id = s.id AND p.approval_status = 'approved')
    ) AS x
    FROM public.seller_collaborators sc
    JOIN public.sellers s ON s.id = sc.seller_id
    JOIN public.collaborator_roles r ON r.slug = sc.role_slug
    WHERE sc.user_id = auth.uid() AND sc.status <> 'removed'
  ) t;
$$;
REVOKE ALL ON FUNCTION public.my_collaborations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_collaborations() TO authenticated, service_role;

-- ============ products / variations access for collaborators ============
CREATE POLICY "Collaborators view assigned products" ON public.products
  FOR SELECT TO authenticated USING (public.has_seller_permission(seller_id, 'products.view'));
CREATE POLICY "Collaborators create assigned products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.has_seller_permission(seller_id, 'products.create'));
CREATE POLICY "Collaborators update assigned products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.has_seller_permission(seller_id, 'products.update'))
  WITH CHECK (public.has_seller_permission(seller_id, 'products.update'));

CREATE POLICY "Collaborators manage assigned variations" ON public.product_variations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variations.product_id AND public.has_seller_permission(p.seller_id, 'products.update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variations.product_id AND public.has_seller_permission(p.seller_id, 'products.update')));

-- prevent product ownership transfer by non-admin / non-owner
CREATE OR REPLACE FUNCTION public.protect_product_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.seller_id IS DISTINCT FROM OLD.seller_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.seller_id := OLD.seller_id;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.protect_product_owner() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_product_owner_trg ON public.products;
CREATE TRIGGER protect_product_owner_trg BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.protect_product_owner();

-- ============ audit trigger on products ============
CREATE OR REPLACE FUNCTION public.log_product_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text;
  _changes jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT email INTO _email FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    _changes := jsonb_build_object('title', NEW.title, 'base_price', NEW.base_price, 'stock', NEW.stock);
    INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
    VALUES (auth.uid(), _email, NEW.seller_id, 'product', NEW.id, 'product.create', _changes);
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
            _changes || jsonb_build_object('product_title', NEW.title));
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.log_product_activity() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS log_product_activity_trg ON public.products;
CREATE TRIGGER log_product_activity_trg AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_activity();

-- ============ admin management functions ============
CREATE OR REPLACE FUNCTION public.add_seller_collaborator(_email text, _seller_id uuid, _role_slug text, _permissions text[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid;
  _perms text[];
  _row public.seller_collaborators;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(btrim(_email)) LIMIT 1;
  IF _uid IS NULL THEN RAISE EXCEPTION 'no_account'; END IF;

  SELECT COALESCE(_permissions, default_permissions) INTO _perms FROM public.collaborator_roles WHERE slug = _role_slug;
  IF _perms IS NULL THEN RAISE EXCEPTION 'invalid_role'; END IF;

  INSERT INTO public.seller_collaborators (user_id, seller_id, role_slug, permissions, status, invited_by)
  VALUES (_uid, _seller_id, _role_slug, _perms, 'active', auth.uid())
  ON CONFLICT (user_id, seller_id) DO UPDATE
    SET role_slug = EXCLUDED.role_slug, permissions = EXCLUDED.permissions, status = 'active', updated_at = now()
  RETURNING * INTO _row;

  INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), _seller_id, 'collaborator', _row.id,
          'collaborator.add', jsonb_build_object('email', _email, 'role', _role_slug));

  PERFORM public.notify_email(_uid, 'collaborator',
    'Novo acesso de colaborador',
    'Foi atribuído como ' || (SELECT label FROM public.collaborator_roles WHERE slug = _role_slug) ||
    ' da loja ' || (SELECT store_name FROM public.sellers WHERE id = _seller_id) || '.',
    '/perfil');

  RETURN to_jsonb(_row);
END; $$;
REVOKE ALL ON FUNCTION public.add_seller_collaborator(text, uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_seller_collaborator(text, uuid, text, text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_collaborator_status(_id uuid, _status public.collaborator_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.seller_collaborators;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.seller_collaborators SET status = _status, updated_at = now() WHERE id = _id RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), _row.seller_id, 'collaborator', _row.id,
          'collaborator.status', jsonb_build_object('status', _status));
END; $$;
REVOKE ALL ON FUNCTION public.set_collaborator_status(uuid, public.collaborator_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_collaborator_status(uuid, public.collaborator_status) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_collaborator_role(_id uuid, _role_slug text, _permissions text[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _perms text[]; _row public.seller_collaborators;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(_permissions, default_permissions) INTO _perms FROM public.collaborator_roles WHERE slug = _role_slug;
  IF _perms IS NULL THEN RAISE EXCEPTION 'invalid_role'; END IF;
  UPDATE public.seller_collaborators SET role_slug = _role_slug, permissions = _perms, updated_at = now()
    WHERE id = _id RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), _row.seller_id, 'collaborator', _row.id,
          'collaborator.role', jsonb_build_object('role', _role_slug, 'permissions', _perms));
END; $$;
REVOKE ALL ON FUNCTION public.set_collaborator_role(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_collaborator_role(uuid, text, text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_seller_collaborators(_seller_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _out jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb) INTO _out FROM (
    SELECT jsonb_build_object(
      'id', sc.id, 'user_id', sc.user_id, 'seller_id', sc.seller_id,
      'store_name', s.store_name, 'role_slug', sc.role_slug, 'role_label', r.label,
      'permissions', sc.permissions, 'status', sc.status, 'created_at', sc.created_at,
      'name', p.name, 'email', COALESCE(p.email, u.email), 'avatar_url', p.avatar_url,
      'products_created', (SELECT count(*) FROM public.activity_logs al
                            WHERE al.actor_id = sc.user_id AND al.seller_id = sc.seller_id AND al.action = 'product.create')
    ) AS x
    FROM public.seller_collaborators sc
    JOIN public.sellers s ON s.id = sc.seller_id
    JOIN public.collaborator_roles r ON r.slug = sc.role_slug
    LEFT JOIN public.profiles p ON p.id = sc.user_id
    LEFT JOIN auth.users u ON u.id = sc.user_id
    WHERE (_seller_id IS NULL OR sc.seller_id = _seller_id)
  ) t;
  RETURN _out;
END; $$;
REVOKE ALL ON FUNCTION public.get_seller_collaborators(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_collaborators(uuid) TO authenticated, service_role;