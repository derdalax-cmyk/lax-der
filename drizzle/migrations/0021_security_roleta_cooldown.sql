-- Proteção contra força bruta de códigos da Roleta: tentativas falhadas com cooldown progressivo por utilizador
CREATE TABLE public.roleta_spin_attempts (
  user_id uuid PRIMARY KEY,
  fails integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.roleta_spin_attempts TO service_role;
ALTER TABLE public.roleta_spin_attempts ENABLE ROW LEVEL SECURITY;
-- Sem policies: acesso direto bloqueado; apenas a função SECURITY DEFINER acede.

CREATE OR REPLACE FUNCTION public.roleta_spin(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_camp record;
  v_code_id uuid;
  v_top_used int;
  v_total numeric := 0;
  v_r numeric;
  v_acc numeric := 0;
  v_pct int := 0;
  e jsonb;
  v_spin record;
  v_norm text;
  v_locked timestamptz;
  v_fails int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Inicie sessão para girar a roleta'; END IF;

  -- Cooldown progressivo por utilizador após tentativas falhadas
  SELECT fails, locked_until INTO v_fails, v_locked
    FROM public.roleta_spin_attempts WHERE user_id = v_uid FOR UPDATE;
  IF v_locked IS NOT NULL AND v_locked > now() THEN
    RAISE EXCEPTION 'Muitas tentativas seguidas. Tente novamente em % minuto(s).',
      GREATEST(1, ceil(extract(epoch FROM (v_locked - now())) / 60)::int);
  END IF;

  SELECT * INTO v_camp FROM public.roleta_campaigns WHERE id = public.roleta_current_campaign();
  IF v_camp.id IS NULL THEN RAISE EXCEPTION 'Não existe campanha ativa'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || v_camp.id::text));

  v_norm := upper(btrim(COALESCE(_code,'')));
  IF v_norm !~ '^[A-Z0-9]{5}$' THEN
    INSERT INTO public.roleta_spin_attempts (user_id, fails, locked_until, updated_at)
    VALUES (v_uid, 1, now() + interval '1 minute', now())
    ON CONFLICT (user_id) DO UPDATE
      SET fails = roleta_spin_attempts.fails + 1,
          locked_until = now() + make_interval(mins => LEAST(roleta_spin_attempts.fails + 1, 30)),
          updated_at = now();
    RAISE EXCEPTION 'Código inválido ou já utilizado';
  END IF;

  UPDATE public.roleta_codes SET status = 'REDEEMED', redeemed_by = v_uid, redeemed_at = now()
   WHERE code = v_norm AND status = 'AVAILABLE' AND campaign_id = v_camp.id
  RETURNING id INTO v_code_id;
  IF v_code_id IS NULL THEN
    INSERT INTO public.roleta_spin_attempts (user_id, fails, locked_until, updated_at)
    VALUES (v_uid, 1, now() + interval '1 minute', now())
    ON CONFLICT (user_id) DO UPDATE
      SET fails = roleta_spin_attempts.fails + 1,
          locked_until = now() + make_interval(mins => LEAST(roleta_spin_attempts.fails + 1, 30)),
          updated_at = now();
    RAISE EXCEPTION 'Código inválido ou já utilizado';
  END IF;

  -- Sucesso: limpar registo de tentativas falhadas
  DELETE FROM public.roleta_spin_attempts WHERE user_id = v_uid;

  PERFORM pg_advisory_xact_lock(hashtext('top' || v_camp.id::text));
  SELECT count(*) INTO v_top_used FROM public.roleta_spins
   WHERE campaign_id = v_camp.id AND percent >= v_camp.top_prize_percent
     AND date_trunc('month', won_at) = date_trunc('month', now());
  SELECT COALESCE(sum((x->>'weight')::numeric),0) INTO v_total FROM jsonb_array_elements(v_camp.prizes) x
   WHERE (x->>'weight')::numeric > 0 AND NOT ((x->>'percent')::int >= v_camp.top_prize_percent AND v_top_used >= v_camp.top_prize_limit);
  IF v_total > 0 THEN
    v_r := random() * v_total;
    FOR e IN SELECT x FROM jsonb_array_elements(v_camp.prizes) x
              WHERE (x->>'weight')::numeric > 0 AND NOT ((x->>'percent')::int >= v_camp.top_prize_percent AND v_top_used >= v_camp.top_prize_limit)
    LOOP
      v_acc := v_acc + (e->>'weight')::numeric;
      v_pct := (e->>'percent')::int;
      EXIT WHEN v_r < v_acc;
    END LOOP;
  END IF;
  INSERT INTO public.roleta_spins (campaign_id, user_id, code_id, percent, max_discount_mt, status, expires_at)
  VALUES (v_camp.id, v_uid, v_code_id, v_pct, v_camp.max_discount_mt,
          CASE WHEN v_pct > 0 THEN 'ACTIVE' ELSE 'LOST' END,
          CASE WHEN v_pct > 0 THEN now() + make_interval(days => v_camp.validity_days) END)
  RETURNING * INTO v_spin;
  RETURN jsonb_build_object('id', v_spin.id, 'percent', v_spin.percent, 'status', v_spin.status, 'expires_at', v_spin.expires_at, 'max_discount_mt', v_spin.max_discount_mt);
END
$function$;
