
-- ========== TABLES ==========
CREATE TABLE public.roleta_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  validity_days integer NOT NULL DEFAULT 7 CHECK (validity_days BETWEEN 1 AND 365),
  max_discount_mt numeric NOT NULL DEFAULT 500 CHECK (max_discount_mt > 0),
  prizes jsonb NOT NULL DEFAULT '[{"percent":0,"weight":30},{"percent":5,"weight":30},{"percent":10,"weight":22},{"percent":15,"weight":12},{"percent":20,"weight":5},{"percent":25,"weight":0.8},{"percent":30,"weight":0.2}]'::jsonb,
  top_prize_percent integer NOT NULL DEFAULT 30 CHECK (top_prize_percent BETWEEN 1 AND 30),
  top_prize_limit integer NOT NULL DEFAULT 5 CHECK (top_prize_limit >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX roleta_one_active_campaign ON public.roleta_campaigns ((true)) WHERE is_active;
GRANT SELECT, INSERT, UPDATE ON public.roleta_campaigns TO authenticated;
GRANT ALL ON public.roleta_campaigns TO service_role;
ALTER TABLE public.roleta_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage roleta campaigns" ON public.roleta_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_roleta_campaigns_updated BEFORE UPDATE ON public.roleta_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.roleta_validate_campaign()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_sum numeric; v_bad int;
BEGIN
  IF jsonb_typeof(NEW.prizes) <> 'array' OR jsonb_array_length(NEW.prizes) = 0 THEN
    RAISE EXCEPTION 'Prémios inválidos';
  END IF;
  SELECT COALESCE(sum((e->>'weight')::numeric),0),
         count(*) FILTER (WHERE (e->>'percent')::int < 0 OR (e->>'percent')::int > 30 OR (e->>'weight')::numeric < 0)
    INTO v_sum, v_bad FROM jsonb_array_elements(NEW.prizes) e;
  IF v_bad > 0 THEN RAISE EXCEPTION 'Percentagens devem estar entre 0 e 30 e probabilidades ≥ 0'; END IF;
  IF abs(v_sum - 100) > 0.0001 THEN RAISE EXCEPTION 'A soma das probabilidades deve ser 100%% (atual: %)', v_sum; END IF;
  IF NEW.starts_at IS NOT NULL AND NEW.ends_at IS NOT NULL AND NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'A data de fim deve ser posterior ao início';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_roleta_validate_campaign BEFORE INSERT OR UPDATE ON public.roleta_campaigns FOR EACH ROW EXECUTE FUNCTION public.roleta_validate_campaign();

CREATE TABLE public.roleta_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{5}$'),
  campaign_id uuid NOT NULL REFERENCES public.roleta_campaigns(id),
  status text NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','REDEEMED')),
  origin text NOT NULL CHECK (origin IN ('ADMIN','REFERRAL')),
  created_by uuid,
  owner_user_id uuid,
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX roleta_one_referral_code_per_campaign ON public.roleta_codes (campaign_id, owner_user_id) WHERE origin = 'REFERRAL';
GRANT SELECT ON public.roleta_codes TO authenticated;
GRANT ALL ON public.roleta_codes TO service_role;
ALTER TABLE public.roleta_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view roleta codes" ON public.roleta_codes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users view own roleta codes" ON public.roleta_codes FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR redeemed_by = auth.uid());

CREATE TABLE public.roleta_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.roleta_campaigns(id),
  user_id uuid NOT NULL,
  code_id uuid NOT NULL REFERENCES public.roleta_codes(id),
  percent integer NOT NULL CHECK (percent BETWEEN 0 AND 30),
  max_discount_mt numeric NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','RESERVED','REDEEMED','EXPIRED','LOST')),
  won_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  order_id uuid REFERENCES public.orders(id),
  reserved_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id),
  UNIQUE (code_id)
);
CREATE INDEX roleta_spins_user ON public.roleta_spins (user_id, status);
GRANT SELECT ON public.roleta_spins TO authenticated;
GRANT ALL ON public.roleta_spins TO service_role;
ALTER TABLE public.roleta_spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own spins" ON public.roleta_spins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view spins" ON public.roleta_spins FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.roleta_referral_links (
  user_id uuid PRIMARY KEY,
  ref_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roleta_referral_links TO authenticated;
GRANT ALL ON public.roleta_referral_links TO service_role;
ALTER TABLE public.roleta_referral_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ref link" ON public.roleta_referral_links FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.roleta_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  campaign_id uuid REFERENCES public.roleta_campaigns(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_id <> referred_id)
);
CREATE INDEX roleta_referrals_referrer ON public.roleta_referrals (referrer_id, campaign_id);
GRANT SELECT ON public.roleta_referrals TO authenticated;
GRANT ALL ON public.roleta_referrals TO service_role;
ALTER TABLE public.roleta_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referrals" ON public.roleta_referrals FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.roleta_product_participation (
  campaign_id uuid NOT NULL REFERENCES public.roleta_campaigns(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES public.sellers(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, product_id)
);
GRANT SELECT ON public.roleta_product_participation TO authenticated;
GRANT ALL ON public.roleta_product_participation TO service_role;
ALTER TABLE public.roleta_product_participation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own participation" ON public.roleta_product_participation FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR seller_id = public.current_seller_id() OR public.has_seller_permission(seller_id,'products.update'));

CREATE TABLE public.roleta_popup_state (
  user_id uuid PRIMARY KEY,
  dismissed_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roleta_popup_state TO authenticated;
GRANT ALL ON public.roleta_popup_state TO service_role;
ALTER TABLE public.roleta_popup_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own popup state" ON public.roleta_popup_state FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.order_items
  ADD COLUMN roleta_spin_id uuid REFERENCES public.roleta_spins(id),
  ADD COLUMN roleta_percent integer,
  ADD COLUMN roleta_discount numeric,
  ADD COLUMN price_before_roleta numeric;

-- ========== HELPERS ==========
CREATE OR REPLACE FUNCTION public.roleta_current_campaign()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.roleta_campaigns
   WHERE is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now())
   ORDER BY created_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.roleta_random_code()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE a text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; c text; i int;
BEGIN
  LOOP
    c := '';
    FOR i IN 1..5 LOOP c := c || substr(a, 1 + floor(random()*36)::int, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.roleta_codes WHERE code = c);
  END LOOP;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.roleta_expire_mine(_uid uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.roleta_spins SET status = 'EXPIRED'
   WHERE user_id = _uid AND status = 'ACTIVE' AND expires_at <= now();
$$;

-- ========== PUBLIC / USER RPCs ==========
CREATE OR REPLACE FUNCTION public.get_roleta_public()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', c.id, 'name', c.name, 'ends_at', c.ends_at,
    'max_percent', (SELECT max((e->>'percent')::int) FROM jsonb_array_elements(c.prizes) e WHERE (e->>'weight')::numeric > 0),
    'max_discount_mt', c.max_discount_mt, 'validity_days', c.validity_days,
    'prizes', (SELECT jsonb_agg((e->>'percent')::int ORDER BY (e->>'percent')::int) FROM jsonb_array_elements(c.prizes) e)
  ) END
  FROM (SELECT 1) x LEFT JOIN public.roleta_campaigns c ON c.id = public.roleta_current_campaign();
$$;

CREATE OR REPLACE FUNCTION public.get_my_roleta()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_camp uuid; v_spin record; v_cur record; v_link text; v_count int := 0; v_code record; v_eligible jsonb := '[]'::jsonb; v_popup timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  PERFORM public.roleta_expire_mine(v_uid);
  v_camp := public.roleta_current_campaign();

  -- reward currently usable (any campaign)
  SELECT * INTO v_spin FROM public.roleta_spins
   WHERE user_id = v_uid AND status IN ('ACTIVE','RESERVED') ORDER BY won_at DESC LIMIT 1;
  -- spin in current campaign
  IF v_camp IS NOT NULL THEN
    SELECT * INTO v_cur FROM public.roleta_spins WHERE user_id = v_uid AND campaign_id = v_camp;
    SELECT count(*) INTO v_count FROM public.roleta_referrals WHERE referrer_id = v_uid AND campaign_id = v_camp;
    SELECT code, status INTO v_code FROM public.roleta_codes WHERE campaign_id = v_camp AND owner_user_id = v_uid AND origin = 'REFERRAL';
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
  IF v_spin.id IS NOT NULL AND v_spin.status = 'ACTIVE' THEN
    SELECT COALESCE(jsonb_agg(pp.product_id), '[]'::jsonb) INTO v_eligible
      FROM public.roleta_product_participation pp WHERE pp.campaign_id = v_spin.campaign_id;
  END IF;
  SELECT dismissed_until INTO v_popup FROM public.roleta_popup_state WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'campaign', public.get_roleta_public(),
    'current_spin', CASE WHEN v_cur.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', v_cur.id, 'percent', v_cur.percent, 'status', v_cur.status, 'won_at', v_cur.won_at, 'expires_at', v_cur.expires_at, 'max_discount_mt', v_cur.max_discount_mt) END,
    'reward', CASE WHEN v_spin.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', v_spin.id, 'campaign_id', v_spin.campaign_id, 'percent', v_spin.percent, 'status', v_spin.status,
        'expires_at', v_spin.expires_at, 'max_discount_mt', v_spin.max_discount_mt, 'order_id', v_spin.order_id) END,
    'eligible_product_ids', v_eligible,
    'referral', jsonb_build_object('ref_code', v_link, 'count', v_count, 'needed', 5,
        'code', v_code.code, 'code_status', v_code.status),
    'popup_dismissed_until', v_popup,
    'history', COALESCE((SELECT jsonb_agg(jsonb_build_object('campaign', c.name, 'percent', s.percent, 'status', s.status, 'won_at', s.won_at, 'expires_at', s.expires_at) ORDER BY s.won_at DESC)
        FROM public.roleta_spins s JOIN public.roleta_campaigns c ON c.id = s.campaign_id WHERE s.user_id = v_uid), '[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.roleta_dismiss_popup()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.roleta_popup_state (user_id, dismissed_until, updated_at)
  SELECT auth.uid(), now() + interval '24 hours', now() WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE SET dismissed_until = EXCLUDED.dismissed_until, updated_at = now();
$$;

CREATE OR REPLACE FUNCTION public.roleta_spin(_code text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_camp record; v_code_id uuid; v_top_used int; v_total numeric := 0; v_r numeric; v_acc numeric := 0; v_pct int := 0; e jsonb; v_spin record; v_norm text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Inicie sessão para girar a roleta'; END IF;
  SELECT * INTO v_camp FROM public.roleta_campaigns WHERE id = public.roleta_current_campaign();
  IF v_camp.id IS NULL THEN RAISE EXCEPTION 'Não existe campanha ativa'; END IF;
  -- serialize per user+campaign
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || v_camp.id::text));
  IF EXISTS (SELECT 1 FROM public.roleta_spins WHERE user_id = v_uid AND campaign_id = v_camp.id) THEN
    RAISE EXCEPTION 'Já girou a roleta nesta campanha';
  END IF;
  v_norm := upper(btrim(COALESCE(_code,'')));
  IF v_norm !~ '^[A-Z0-9]{5}$' THEN RAISE EXCEPTION 'Código inválido'; END IF;

  -- atomic consumption
  UPDATE public.roleta_codes SET status = 'REDEEMED', redeemed_by = v_uid, redeemed_at = now()
   WHERE code = v_norm AND status = 'AVAILABLE' AND campaign_id = v_camp.id
  RETURNING id INTO v_code_id;
  IF v_code_id IS NULL THEN RAISE EXCEPTION 'Código inválido ou já utilizado'; END IF;

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
END $$;

CREATE OR REPLACE FUNCTION public.roleta_generate_referral_code()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_camp uuid; v_count int; v_code text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Inicie sessão'; END IF;
  v_camp := public.roleta_current_campaign();
  IF v_camp IS NULL THEN RAISE EXCEPTION 'Não existe campanha ativa'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ref' || v_uid::text || v_camp::text));
  SELECT code INTO v_code FROM public.roleta_codes WHERE campaign_id = v_camp AND owner_user_id = v_uid AND origin = 'REFERRAL';
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  SELECT count(*) INTO v_count FROM public.roleta_referrals WHERE referrer_id = v_uid AND campaign_id = v_camp;
  IF v_count < 5 THEN RAISE EXCEPTION 'Precisa de 5 indicações (tem %)', v_count; END IF;
  v_code := public.roleta_random_code();
  INSERT INTO public.roleta_codes (code, campaign_id, origin, created_by, owner_user_id)
  VALUES (v_code, v_camp, 'REFERRAL', v_uid, v_uid);
  RETURN v_code;
END $$;

CREATE OR REPLACE FUNCTION public.roleta_claim_referral(_ref text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_uid uuid := auth.uid(); v_referrer uuid; v_created timestamptz; v_ref_created timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'auth'); END IF;
  SELECT user_id INTO v_referrer FROM public.roleta_referral_links WHERE ref_code = lower(btrim(COALESCE(_ref,'')));
  IF v_referrer IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;
  IF v_referrer = v_uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
  IF EXISTS (SELECT 1 FROM public.roleta_referrals WHERE referred_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already');
  END IF;
  SELECT created_at INTO v_created FROM auth.users WHERE id = v_uid;
  SELECT created_at INTO v_ref_created FROM auth.users WHERE id = v_referrer;
  IF v_created IS NULL OR v_created < now() - interval '48 hours' OR v_created <= v_ref_created THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_new');
  END IF;
  INSERT INTO public.roleta_referrals (referrer_id, referred_id, campaign_id)
  VALUES (v_referrer, v_uid, public.roleta_current_campaign())
  ON CONFLICT (referred_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.roleta_set_product_participation(_product_id uuid, _participate boolean)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_camp uuid := public.roleta_current_campaign(); v_seller uuid;
BEGIN
  IF v_camp IS NULL THEN RAISE EXCEPTION 'Não existe campanha ativa'; END IF;
  SELECT seller_id INTO v_seller FROM public.products WHERE id = _product_id;
  IF NOT (public.has_role(auth.uid(),'admin')
          OR (v_seller IS NOT NULL AND v_seller = public.current_seller_id())
          OR public.has_seller_permission(v_seller, 'products.update')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF _participate THEN
    INSERT INTO public.roleta_product_participation (campaign_id, product_id, seller_id, created_by)
    VALUES (v_camp, _product_id, v_seller, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.roleta_product_participation WHERE campaign_id = v_camp AND product_id = _product_id;
  END IF;
END $$;

-- apply reward to a freshly created order (server decides)
CREATE OR REPLACE FUNCTION public.roleta_apply_to_order(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_spin record; v_remaining numeric; r record; v_ref numeric; v_amt numeric; v_line numeric; v_unit numeric; v_total_disc numeric := 0;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND roleta_spin_id IS NOT NULL) THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'already');
  END IF;
  PERFORM public.roleta_expire_mine(v_uid);
  SELECT * INTO v_spin FROM public.roleta_spins
   WHERE user_id = v_uid AND status = 'ACTIVE' AND expires_at > now()
   ORDER BY won_at DESC LIMIT 1 FOR UPDATE;
  IF v_spin.id IS NULL THEN RETURN jsonb_build_object('applied', false); END IF;
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
    RETURN jsonb_build_object('applied', true, 'discount', v_total_disc, 'percent', v_spin.percent);
  END IF;
  RETURN jsonb_build_object('applied', false, 'reason', 'not_better');
END $$;

-- lifecycle driven by seller part status
CREATE OR REPLACE FUNCTION public.roleta_on_order_seller_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_spin record; v_delivered boolean; v_open boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT * INTO v_spin FROM public.roleta_spins
   WHERE order_id = NEW.order_id AND status IN ('RESERVED','REDEEMED') FOR UPDATE;
  IF v_spin.id IS NULL THEN RETURN NEW; END IF;

  SELECT
    bool_or(os.status = 'delivered'),
    bool_or(os.status <> 'cancelled')
    INTO v_delivered, v_open
    FROM public.order_sellers os
   WHERE os.order_id = NEW.order_id
     AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = os.order_id AND oi.seller_id = os.seller_id AND oi.roleta_spin_id = v_spin.id);

  IF COALESCE(v_delivered,false) THEN
    UPDATE public.roleta_spins SET status = 'REDEEMED', redeemed_at = COALESCE(redeemed_at, now()) WHERE id = v_spin.id;
  ELSIF NOT COALESCE(v_open,false) THEN
    UPDATE public.roleta_spins
       SET status = CASE WHEN expires_at > now() THEN 'ACTIVE' ELSE 'EXPIRED' END,
           order_id = NULL, reserved_at = NULL, redeemed_at = NULL
     WHERE id = v_spin.id;
  ELSE
    UPDATE public.roleta_spins SET status = 'RESERVED', redeemed_at = NULL WHERE id = v_spin.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_roleta_order_seller_status AFTER UPDATE OF status ON public.order_sellers
  FOR EACH ROW EXECUTE FUNCTION public.roleta_on_order_seller_status();

-- ========== ADMIN RPCs ==========
CREATE OR REPLACE FUNCTION public.roleta_admin_generate_codes(_campaign_id uuid, _qty integer)
RETURNS SETOF text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE i int; c text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _qty IS NULL OR _qty < 1 OR _qty > 1000 THEN RAISE EXCEPTION 'Quantidade entre 1 e 1000'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.roleta_campaigns WHERE id = _campaign_id) THEN RAISE EXCEPTION 'Campanha inexistente'; END IF;
  FOR i IN 1.._qty LOOP
    c := public.roleta_random_code();
    INSERT INTO public.roleta_codes (code, campaign_id, origin, created_by) VALUES (c, _campaign_id, 'ADMIN', auth.uid());
    RETURN NEXT c;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.roleta_admin_codes(_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'code', c.code, 'status', c.status, 'origin', c.origin, 'created_at', c.created_at,
      'redeemed_at', c.redeemed_at,
      'owner', COALESCE(po.name, po.email), 'redeemed_by', COALESCE(pr.name, pr.email)) ORDER BY c.created_at DESC)
    FROM public.roleta_codes c
    LEFT JOIN public.profiles po ON po.id = c.owner_user_id
    LEFT JOIN public.profiles pr ON pr.id = c.redeemed_by
    WHERE c.campaign_id = _campaign_id), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.roleta_admin_referrals(_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(t ORDER BY t.count DESC) FROM (
    SELECT r.referrer_id AS user_id, COALESCE(p.name, p.email) AS name, count(*)::int AS count,
           c.code, c.status AS code_status
      FROM public.roleta_referrals r
      LEFT JOIN public.profiles p ON p.id = r.referrer_id
      LEFT JOIN public.roleta_codes c ON c.campaign_id = _campaign_id AND c.owner_user_id = r.referrer_id AND c.origin = 'REFERRAL'
     WHERE r.campaign_id = _campaign_id
     GROUP BY r.referrer_id, p.name, p.email, c.code, c.status) t), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.roleta_admin_stats(_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_camp record; v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.roleta_spins SET status = 'EXPIRED' WHERE campaign_id = _campaign_id AND status = 'ACTIVE' AND expires_at <= now();
  SELECT * INTO v_camp FROM public.roleta_campaigns WHERE id = _campaign_id;
  SELECT jsonb_build_object(
    'codes_total', (SELECT count(*) FROM public.roleta_codes WHERE campaign_id = _campaign_id),
    'codes_available', (SELECT count(*) FROM public.roleta_codes WHERE campaign_id = _campaign_id AND status = 'AVAILABLE'),
    'spins', count(*),
    'won', count(*) FILTER (WHERE percent > 0),
    'lost', count(*) FILTER (WHERE percent = 0),
    'active', count(*) FILTER (WHERE status = 'ACTIVE'),
    'reserved', count(*) FILTER (WHERE status = 'RESERVED'),
    'redeemed', count(*) FILTER (WHERE status = 'REDEEMED'),
    'expired', count(*) FILTER (WHERE status = 'EXPIRED'),
    'distribution', (SELECT COALESCE(jsonb_object_agg(percent, n), '{}'::jsonb) FROM (SELECT percent, count(*) n FROM public.roleta_spins WHERE campaign_id = _campaign_id GROUP BY percent) d),
    'discount_total', (SELECT COALESCE(sum(oi.roleta_discount),0) FROM public.order_items oi JOIN public.roleta_spins s ON s.id = oi.roleta_spin_id WHERE s.campaign_id = _campaign_id AND s.status = 'REDEEMED'),
    'sales_total', (SELECT COALESCE(sum(oi.price*oi.quantity),0) FROM public.order_items oi JOIN public.roleta_spins s ON s.id = oi.roleta_spin_id WHERE s.campaign_id = _campaign_id AND s.status = 'REDEEMED'),
    'top_used', count(*) FILTER (WHERE percent >= v_camp.top_prize_percent AND date_trunc('month', won_at) = date_trunc('month', now())),
    'top_limit', v_camp.top_prize_limit, 'top_percent', v_camp.top_prize_percent
  ) INTO v FROM public.roleta_spins WHERE campaign_id = _campaign_id;
  RETURN v;
END $$;

-- ========== seller orders: include roleta snapshot ==========
CREATE OR REPLACE FUNCTION public.get_seller_orders()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_seller uuid := public.current_seller_id();
  v jsonb;
BEGIN
  IF v_seller IS NULL THEN RETURN jsonb_build_object('error', 'not_seller'); END IF;
  SELECT jsonb_build_object(
    'orders', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.created_at DESC) FROM (
        SELECT o.id, o.customer_name, o.customer_phone,
          (o.shipping_address->>'city') AS city, o.shipping_address, o.notes,
          o.subtotal, o.shipping, o.total, o.payment_reference,
          o.status::text AS status, o.payment_status::text AS payment_status,
          o.payment_method, o.created_at, sub.seller_total, sub.items,
          COALESCE(os.status, 'pending') AS seller_status, os.tracking_code, os.notes AS seller_notes
        FROM public.orders o
        JOIN LATERAL (
          SELECT sum(oi.price * oi.quantity) AS seller_total,
            jsonb_agg(jsonb_build_object(
              'title', COALESCE(p.title, oi.title_snapshot, 'Produto'),
              'quantity', oi.quantity, 'price', oi.price, 'size', pv.size, 'color', pv.color,
              'price_before_roleta', oi.price_before_roleta, 'roleta_percent', oi.roleta_percent, 'roleta_discount', oi.roleta_discount,
              'images', COALESCE(p.images, jsonb_build_array(oi.image_snapshot)))) AS items
          FROM public.order_items oi
          LEFT JOIN public.products p ON p.id = oi.product_id
          LEFT JOIN public.product_variations pv ON pv.id = oi.variation_id
          WHERE oi.order_id = o.id AND oi.seller_id = v_seller
        ) sub ON true
        LEFT JOIN public.order_sellers os ON os.order_id = o.id AND os.seller_id = v_seller
        WHERE EXISTS (SELECT 1 FROM public.order_items oi2 WHERE oi2.order_id = o.id AND oi2.seller_id = v_seller)
      ) t
    ), '[]'::jsonb),
    'stats', (
      SELECT jsonb_build_object(
        'total_orders', COALESCE(count(DISTINCT o.id), 0),
        'revenue', COALESCE(sum(oi.price * oi.quantity) FILTER (WHERE os.status = 'delivered'), 0),
        'pending', COALESCE(count(DISTINCT o.id) FILTER (WHERE COALESCE(os.status,'pending') IN ('pending','processing','sent')), 0)
      )
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      LEFT JOIN public.order_sellers os ON os.order_id = o.id AND os.seller_id = v_seller
      WHERE oi.seller_id = v_seller
    )
  ) INTO v;
  RETURN v;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.roleta_expire_mine(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.roleta_random_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_roleta_public() TO anon, authenticated;
