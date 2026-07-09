CREATE TABLE public.seller_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, user_id)
);

GRANT SELECT ON public.seller_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_reviews TO authenticated;
GRANT ALL ON public.seller_reviews TO service_role;

ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seller reviews"
  ON public.seller_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users create own review"
  ON public.seller_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own review"
  ON public.seller_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own review"
  ON public.seller_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_seller_reviews_updated_at
  BEFORE UPDATE ON public.seller_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.recompute_seller_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seller uuid := COALESCE(NEW.seller_id, OLD.seller_id);
BEGIN
  UPDATE public.sellers s
     SET rating = COALESCE((SELECT round(avg(rating)::numeric, 1) FROM public.seller_reviews WHERE seller_id = v_seller), 0),
         total_reviews = (SELECT count(*) FROM public.seller_reviews WHERE seller_id = v_seller)
   WHERE s.id = v_seller;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_recompute_seller_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.seller_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_seller_rating();

CREATE OR REPLACE FUNCTION public.get_public_seller(_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'store_name', s.store_name,
    'logo_url', s.logo_url,
    'city', s.city,
    'province', s.province,
    'description', s.description,
    'rating', s.rating,
    'total_reviews', s.total_reviews,
    'created_at', s.created_at,
    'product_count', (SELECT count(*) FROM public.products p WHERE p.seller_id = s.id AND p.approval_status = 'approved' AND p.status <> 'sold')
  )
  FROM public.sellers s
  WHERE s.id = _id AND s.status = 'approved';
$$;

CREATE OR REPLACE FUNCTION public.get_seller_reviews(_seller_id uuid)
RETURNS TABLE(id uuid, rating smallint, comment text, created_at timestamptz, reviewer_name text, reviewer_avatar text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.id, r.rating, r.comment, r.created_at,
         COALESCE(NULLIF(pr.name, ''), 'Cliente') AS reviewer_name,
         pr.avatar_url AS reviewer_avatar
  FROM public.seller_reviews r
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  WHERE r.seller_id = _seller_id
  ORDER BY r.created_at DESC;
$$;