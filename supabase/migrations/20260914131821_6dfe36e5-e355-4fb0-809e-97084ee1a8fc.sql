
-- Team list for the authenticated (approved) store owner
CREATE OR REPLACE FUNCTION public.get_my_team()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _sid uuid; _out jsonb;
BEGIN
  _sid := public.current_seller_id();
  IF _sid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb) INTO _out FROM (
    SELECT jsonb_build_object(
      'id', sc.id,
      'user_id', sc.user_id,
      'seller_id', sc.seller_id,
      'role_slug', sc.role_slug,
      'role_label', r.label,
      'permissions', sc.permissions,
      'status', sc.status,
      'created_at', sc.created_at,
      'name', p.name,
      'email', COALESCE(p.email, u.email),
      'avatar_url', p.avatar_url,
      'products_created', (SELECT count(*) FROM public.activity_logs al
                            WHERE al.actor_id = sc.user_id AND al.seller_id = sc.seller_id
                              AND al.action = 'product.create'),
      'recent', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                  'id', al.id, 'action', al.action, 'entity_type', al.entity_type,
                  'entity_id', al.entity_id, 'changes', al.changes, 'created_at', al.created_at
                ) ORDER BY al.created_at DESC), '[]'::jsonb)
        FROM (SELECT * FROM public.activity_logs al2
               WHERE al2.actor_id = sc.user_id AND al2.seller_id = sc.seller_id
               ORDER BY al2.created_at DESC LIMIT 5) al
      )
    ) AS x
    FROM public.seller_collaborators sc
    JOIN public.collaborator_roles r ON r.slug = sc.role_slug
    LEFT JOIN public.profiles p ON p.id = sc.user_id
    LEFT JOIN auth.users u ON u.id = sc.user_id
    WHERE sc.seller_id = _sid AND sc.status <> 'removed'
  ) t;
  RETURN _out;
END; $function$;

REVOKE ALL ON FUNCTION public.get_my_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_team() TO authenticated;

-- Full activity history of one collaborator, scoped to the owner's store
CREATE OR REPLACE FUNCTION public.get_my_team_activity(_user_id uuid, _limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _sid uuid; _out jsonb;
BEGIN
  _sid := public.current_seller_id();
  IF _sid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.seller_collaborators sc
                  WHERE sc.seller_id = _sid AND sc.user_id = _user_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', al.id, 'action', al.action, 'entity_type', al.entity_type,
           'entity_id', al.entity_id, 'changes', al.changes, 'created_at', al.created_at,
           'product_title', pr.title
         ) ORDER BY al.created_at DESC), '[]'::jsonb) INTO _out
  FROM (SELECT * FROM public.activity_logs a
         WHERE a.actor_id = _user_id AND a.seller_id = _sid
         ORDER BY a.created_at DESC LIMIT LEAST(GREATEST(_limit, 1), 500)) al
  LEFT JOIN public.products pr ON pr.id = al.entity_id AND al.entity_type = 'product';
  RETURN _out;
END; $function$;

REVOKE ALL ON FUNCTION public.get_my_team_activity(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_activity(uuid, integer) TO authenticated;

-- Seller may only suspend / reactivate collaborators of their own store
CREATE OR REPLACE FUNCTION public.seller_set_collaborator_status(_id uuid, _status collaborator_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _sid uuid; _row public.seller_collaborators;
BEGIN
  _sid := public.current_seller_id();
  IF _sid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('active', 'suspended') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO _row FROM public.seller_collaborators
   WHERE id = _id AND seller_id = _sid FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _row.status = 'removed' THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.seller_collaborators
     SET status = _status, updated_at = now()
   WHERE id = _id;

  INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), _sid,
          'collaborator', _row.id,
          CASE WHEN _status = 'suspended' THEN 'collaborator.suspend_by_seller'
               ELSE 'collaborator.reactivate_by_seller' END,
          jsonb_build_object('status', _status, 'from', _row.status,
                             'collaborator_user_id', _row.user_id, 'by', 'seller'));
END; $function$;

REVOKE ALL ON FUNCTION public.seller_set_collaborator_status(uuid, collaborator_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_set_collaborator_status(uuid, collaborator_status) TO authenticated;
