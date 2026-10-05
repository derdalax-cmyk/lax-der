-- A) Multiple spins per user/campaign (one per code); multiple referral codes per user
ALTER TABLE public.roleta_spins DROP CONSTRAINT IF EXISTS roleta_spins_campaign_id_user_id_key;
DROP INDEX IF EXISTS public.roleta_one_referral_code_per_campaign;
CREATE INDEX IF NOT EXISTS roleta_spins_user_campaign_idx ON public.roleta_spins (user_id, campaign_id);
CREATE INDEX IF NOT EXISTS roleta_codes_owner_ref_idx ON public.roleta_codes (campaign_id, owner_user_id) WHERE origin = 'REFERRAL';

CREATE OR REPLACE FUNCTION public.roleta_spin(_code text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_camp record; v_code_id uuid; v_top_used int; v_total numeric := 0; v_r numeric; v_acc numeric := 0; v_pct int := 0; e jsonb; v_spin record; v_norm text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Inicie sessão para girar a roleta'; END IF;
  SELECT * INTO v_camp FROM public.roleta_campaigns WHERE id = public.roleta_current_campaign();
  IF v_camp.id IS NULL THEN RAISE EXCEPTION 'Não existe campanha ativa'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || v_camp.id::text));
  v_norm := upper(btrim(COALESCE(_code,'')));
  IF v_norm !~ '^[A-Z0-9]{5}$' THEN RAISE EXCEPTION 'Código inválido'; END IF;
  UPDATE public.roleta_codes SET status = 'REDEEMED', redeemed_by = v_uid, redeemed_at = now()
   WHERE code = v_norm AND status = 'AVAILABLE' AND campaign_id = v_camp.id
  RETURNING id INTO v_code_id;
  IF v_code_id IS NULL THEN RAISE EXCEPTION 'Código inválido ou já utilizado'; END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.roleta_generate_referral_code()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_camp uuid; v_count int; v_issued int; v_code text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Inicie sessão'; END IF;
  v_camp := public.roleta_current_campaign();
  IF v_camp IS NULL THEN RAISE EXCEPTION 'Não existe campanha ativa'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ref' || v_uid::text || v_camp::text));
  SELECT count(*) INTO v_count FROM public.roleta_referrals WHERE referrer_id = v_uid AND campaign_id = v_camp;
  SELECT count(*) INTO v_issued FROM public.roleta_codes WHERE campaign_id = v_camp AND owner_user_id = v_uid AND origin = 'REFERRAL';
  IF v_count - v_issued * 5 < 5 THEN RAISE EXCEPTION 'Precisa de 5 novas indicações (tem %)', GREATEST(v_count - v_issued * 5, 0); END IF;
  v_code := public.roleta_random_code();
  INSERT INTO public.roleta_codes (code, campaign_id, origin, created_by, owner_user_id)
  VALUES (v_code, v_camp, 'REFERRAL', v_uid, v_uid);
  RETURN v_code;
END $function$;

-- Pure calculation of the discount a spin would give on an order (no writes)
CREATE OR REPLACE FUNCTION public.roleta_calc_order_discount(_order_id uuid, _spin_id uuid)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_spin record; v_remaining numeric; r record; v_ref numeric; v_amt numeric; v_line numeric; v_unit numeric; v_total numeric := 0;
BEGIN
  SELECT * INTO v_spin FROM public.roleta_spins WHERE id = _spin_id;
  IF v_spin.id IS NULL OR v_spin.percent <= 0 THEN RETURN 0; END IF;
  v_remaining := v_spin.max_discount_mt;
  FOR r IN
    SELECT oi.id, oi.price, oi.quantity, p.base_price, p.original_price
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      JOIN public.roleta_product_participation pp ON pp.product_id = oi.product_id AND pp.campaign_id = v_spin.campaign_id
     WHERE oi.order_id = _order_id
     ORDER BY oi.price DESC, oi.id
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_ref := CASE WHEN r.price = r.base_price AND COALESCE(r.original_price,0) > r.base_price THEN r.original_price ELSE r.price END;
    v_amt := LEAST(round(v_ref * v_spin.percent / 100.0 * r.quantity, 2), v_remaining);
    v_line := v_ref * r.quantity - v_amt;
    IF v_line < r.price * r.quantity THEN
      v_unit := round(v_line / r.quantity, 2);
      v_remaining := v_remaining - v_amt;
      v_total := v_total + (r.price - v_unit) * r.quantity;
    END IF;
  END LOOP;
  RETURN v_total;
END $function$;
REVOKE EXECUTE ON FUNCTION public.roleta_calc_order_discount(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.roleta_apply_to_order(_order_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_spin record; s record; v_best uuid; v_best_amt numeric := 0; v_d numeric;
  v_remaining numeric; r record; v_ref numeric; v_amt numeric; v_line numeric; v_unit numeric; v_total_disc numeric := 0;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('apply' || v_uid::text));
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND roleta_spin_id IS NOT NULL) THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'already');
  END IF;
  PERFORM public.roleta_expire_mine(v_uid);
  FOR s IN SELECT id FROM public.roleta_spins
            WHERE user_id = v_uid AND status = 'ACTIVE' AND expires_at > now() AND percent > 0
            ORDER BY expires_at ASC FOR UPDATE
  LOOP
    v_d := public.roleta_calc_order_discount(_order_id, s.id);
    IF v_d > v_best_amt THEN v_best_amt := v_d; v_best := s.id; END IF;
  END LOOP;
  IF v_best IS NULL THEN RETURN jsonb_build_object('applied', false, 'reason', 'not_better'); END IF;
  SELECT * INTO v_spin FROM public.roleta_spins WHERE id = v_best;
  v_remaining := v_spin.max_discount_mt;
  FOR r IN
    SELECT oi.id, oi.price, oi.quantity, p.base_price, p.original_price
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      JOIN public.roleta_product_participation pp ON pp.product_id = oi.product_id AND pp.campaign_id = v_spin.campaign_id
     WHERE oi.order_id = _order_id
     ORDER BY oi.price DESC, oi.id
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_ref := CASE WHEN r.price = r.base_price AND COALESCE(r.original_price,0) > r.base_price THEN r.original_price ELSE r.price END;
    v_amt := LEAST(round(v_ref * v_spin.percent / 100.0 * r.quantity, 2), v_remaining);
    v_line := v_ref * r.quantity - v_amt;
    IF v_line < r.price * r.quantity THEN
      v_unit := round(v_line / r.quantity, 2);
      v_remaining := v_remaining - v_amt;
      v_total_disc := v_total_disc + (r.price - v_unit) * r.quantity;
      UPDATE public.order_items
         SET price_before_roleta = r.price, price = v_unit,
             roleta_discount = (r.price - v_unit) * r.quantity,
             roleta_percent = v_spin.percent, roleta_spin_id = v_spin.id
       WHERE id = r.id;
    END IF;
  END LOOP;
  IF v_total_disc > 0 THEN
    UPDATE public.roleta_spins SET status = 'RESERVED', order_id = _order_id, reserved_at = now() WHERE id = v_spin.id;
    PERFORM public.recalc_order_totals(_order_id);
    RETURN jsonb_build_object('applied', true, 'discount', v_total_disc, 'percent', v_spin.percent, 'spin_id', v_spin.id);
  END IF;
  RETURN jsonb_build_object('applied', false, 'reason', 'not_better');
END $function$;

CREATE OR REPLACE FUNCTION public.get_my_roleta()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_camp uuid; v_spin record; v_cur record; v_link text; v_total int := 0; v_issued int := 0; v_code record;
  v_eligible jsonb := '[]'::jsonb; v_popup timestamptz; v_has_spun boolean := false; v_active jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  PERFORM public.roleta_expire_mine(v_uid);
  v_camp := public.roleta_current_campaign();
  SELECT * INTO v_spin FROM public.roleta_spins
   WHERE user_id = v_uid AND status IN ('ACTIVE','RESERVED') ORDER BY (status = 'ACTIVE') DESC, percent DESC, won_at DESC LIMIT 1;
  IF v_camp IS NOT NULL THEN
    SELECT * INTO v_cur FROM public.roleta_spins WHERE user_id = v_uid AND campaign_id = v_camp ORDER BY won_at DESC LIMIT 1;
    v_has_spun := v_cur.id IS NOT NULL;
    SELECT count(*) INTO v_total FROM public.roleta_referrals WHERE referrer_id = v_uid AND campaign_id = v_camp;
    SELECT count(*) INTO v_issued FROM public.roleta_codes WHERE campaign_id = v_camp AND owner_user_id = v_uid AND origin = 'REFERRAL';
    SELECT code, status INTO v_code FROM public.roleta_codes
     WHERE campaign_id = v_camp AND owner_user_id = v_uid AND origin = 'REFERRAL' AND status = 'AVAILABLE'
     ORDER BY created_at DESC LIMIT 1;
  END IF;
  SELECT ref_code INTO v_link FROM public.roleta_referral_links WHERE user_id = v_uid;
  IF v_link IS NULL THEN
    LOOP
      v_link := lower(substr(md5(random()::text || v_uid::text), 1, 8));
      BEGIN
        INSERT INTO public.roleta_referral_links (user_id, ref_code) VALUES (v_uid, v_link);
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        SELECT ref_code INTO v_link FROM public.roleta_referral_links WHERE user_id = v_uid;
        EXIT WHEN v_link IS NOT NULL;
      END;
    END LOOP;
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id, 'campaign_id', s.campaign_id, 'percent', s.percent, 'status', s.status, 'won_at', s.won_at,
      'expires_at', s.expires_at, 'max_discount_mt', s.max_discount_mt,
      'eligible_product_ids', COALESCE((SELECT jsonb_agg(pp.product_id) FROM public.roleta_product_participation pp WHERE pp.campaign_id = s.campaign_id), '[]'::jsonb)
    ) ORDER BY s.percent DESC, s.expires_at ASC), '[]'::jsonb)
    INTO v_active
    FROM public.roleta_spins s WHERE s.user_id = v_uid AND s.status = 'ACTIVE' AND s.expires_at > now() AND s.percent > 0;
  SELECT COALESCE(jsonb_agg(DISTINCT pid), '[]'::jsonb) INTO v_eligible
    FROM (SELECT jsonb_array_elements(a->'eligible_product_ids') pid FROM jsonb_array_elements(v_active) a) q;
  SELECT dismissed_until INTO v_popup FROM public.roleta_popup_state WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'campaign', public.get_roleta_public(),
    'has_spun_current', v_has_spun,
    'current_spin', CASE WHEN v_cur.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', v_cur.id, 'percent', v_cur.percent, 'status', v_cur.status, 'won_at', v_cur.won_at, 'expires_at', v_cur.expires_at, 'max_discount_mt', v_cur.max_discount_mt) END,
    'reward', CASE WHEN v_spin.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', v_spin.id, 'campaign_id', v_spin.campaign_id, 'percent', v_spin.percent, 'status', v_spin.status,
        'expires_at', v_spin.expires_at, 'max_discount_mt', v_spin.max_discount_mt, 'order_id', v_spin.order_id) END,
    'active_rewards', v_active,
    'eligible_product_ids', v_eligible,
    'referral', jsonb_build_object('ref_code', v_link, 'count', GREATEST(v_total - v_issued * 5, 0), 'needed', 5,
        'total', v_total, 'issued', v_issued, 'code', v_code.code, 'code_status', v_code.status),
    'popup_dismissed_until', v_popup,
    'history', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'campaign', c.name, 'percent', s.percent, 'status', s.status,
          'won_at', s.won_at, 'expires_at', s.expires_at, 'order_id', s.order_id) ORDER BY s.won_at DESC)
        FROM public.roleta_spins s JOIN public.roleta_campaigns c ON c.id = s.campaign_id WHERE s.user_id = v_uid), '[]'::jsonb)
  );
END $function$;

CREATE OR REPLACE FUNCTION public.roleta_admin_referrals(_campaign_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(t ORDER BY t.count DESC) FROM (
    SELECT r.referrer_id AS user_id, COALESCE(p.name, p.email) AS name, count(*)::int AS count,
           (SELECT count(*) FROM public.roleta_codes c WHERE c.campaign_id = _campaign_id AND c.owner_user_id = r.referrer_id AND c.origin = 'REFERRAL')::int AS codes_issued,
           (SELECT c.code FROM public.roleta_codes c WHERE c.campaign_id = _campaign_id AND c.owner_user_id = r.referrer_id AND c.origin = 'REFERRAL' ORDER BY c.created_at DESC LIMIT 1) AS code,
           (SELECT c.status FROM public.roleta_codes c WHERE c.campaign_id = _campaign_id AND c.owner_user_id = r.referrer_id AND c.origin = 'REFERRAL' ORDER BY c.created_at DESC LIMIT 1) AS code_status
      FROM public.roleta_referrals r
      LEFT JOIN public.profiles p ON p.id = r.referrer_id
     WHERE r.campaign_id = _campaign_id
     GROUP BY r.referrer_id, p.name, p.email) t), '[]'::jsonb);
END $function$;

-- C) Home banners
CREATE TABLE public.home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  subtitle text,
  alt text,
  link_url text,
  cta_label text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_banners TO authenticated;
GRANT ALL ON public.home_banners TO service_role;
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active banners" ON public.home_banners FOR SELECT TO anon, authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage banners" ON public.home_banners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER home_banners_updated_at BEFORE UPDATE ON public.home_banners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- E) Mozambican phone normalization for new/changed values (legacy values untouched)
CREATE OR REPLACE FUNCTION public.normalize_profile_phone()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.phone IS NOT DISTINCT FROM OLD.phone THEN RETURN NEW; END IF;
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN NEW.phone := NULL; RETURN NEW; END IF;
  v := regexp_replace(NEW.phone, '[\s\-().]', '', 'g');
  v := regexp_replace(v, '^(\+|00)?258', '');
  IF v !~ '^8[2-7][0-9]{7}$' THEN RAISE EXCEPTION 'Introduza um número moçambicano válido.'; END IF;
  NEW.phone := '+258' || v;
  RETURN NEW;
END $function$;
CREATE TRIGGER profiles_normalize_phone BEFORE INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_phone();