-- 1. Ativação por loja
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS ai_generator_enabled boolean NOT NULL DEFAULT false;

-- 2. Registo de uso do gerador
CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  product_id uuid,
  model text NOT NULL,
  images_count integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_generation_logs TO authenticated;
GRANT ALL ON public.ai_generation_logs TO service_role;
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read ai logs" ON public.ai_generation_logs;
CREATE POLICY "admins read ai logs" ON public.ai_generation_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "seller reads own ai logs" ON public.ai_generation_logs;
CREATE POLICY "seller reads own ai logs" ON public.ai_generation_logs
  FOR SELECT TO authenticated
  USING (seller_id = public.current_seller_id());

CREATE INDEX IF NOT EXISTS ai_generation_logs_seller_idx ON public.ai_generation_logs (seller_id, created_at DESC);

-- 3. Autorização: utilizador + loja + permissão + IA ativada
CREATE OR REPLACE FUNCTION public.can_use_ai_generator(_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.id = _seller_id
      AND s.ai_generator_enabled = true
      AND s.status = 'approved'
      AND s.is_blocked = false
      AND (
        s.id = public.current_seller_id()
        OR public.has_seller_permission(_seller_id, 'products.create')
        OR public.has_seller_permission(_seller_id, 'products.update')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_use_ai_generator(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_use_ai_generator(uuid) TO authenticated, service_role;

-- 4. Admin liga/desliga por loja (auditado)
CREATE OR REPLACE FUNCTION public.set_seller_ai_generator(_seller_id uuid, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_old boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT ai_generator_enabled INTO v_old FROM public.sellers WHERE id = _seller_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'seller_not_found';
  END IF;

  UPDATE public.sellers SET ai_generator_enabled = _enabled WHERE id = _seller_id;

  INSERT INTO public.activity_logs (actor_id, actor_email, seller_id, entity_type, entity_id, action, changes)
  VALUES (
    auth.uid(),
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    _seller_id,
    'seller',
    _seller_id,
    CASE WHEN _enabled THEN 'seller.ai_generator_enabled' ELSE 'seller.ai_generator_disabled' END,
    jsonb_build_object('ai_generator_enabled', jsonb_build_object('from', v_old, 'to', _enabled))
  );

  RETURN _enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.set_seller_ai_generator(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.set_seller_ai_generator(uuid, boolean) TO authenticated, service_role;