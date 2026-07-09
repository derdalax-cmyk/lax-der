-- 1. Relax product policies so approved sellers publish directly
DROP POLICY IF EXISTS "Sellers create own products" ON public.products;
CREATE POLICY "Sellers create own products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = current_seller_id());

DROP POLICY IF EXISTS "Sellers update own products" ON public.products;
CREATE POLICY "Sellers update own products" ON public.products
  FOR UPDATE TO authenticated
  USING (seller_id = current_seller_id())
  WITH CHECK (seller_id = current_seller_id());

-- 2. Auto-approval + city inheritance on products
DROP TRIGGER IF EXISTS trg_set_product_approval ON public.products;
CREATE TRIGGER trg_set_product_approval
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_product_approval();

DROP TRIGGER IF EXISTS trg_set_product_city ON public.products;
CREATE TRIGGER trg_set_product_city
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_product_city();

-- 3. Only admin can set/edit seller city (and status/notes/blocked)
CREATE OR REPLACE FUNCTION public.protect_seller_admin_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.status := OLD.status;
      NEW.approved_at := OLD.approved_at;
      NEW.admin_notes := OLD.admin_notes;
      NEW.is_blocked := OLD.is_blocked;
      NEW.city := OLD.city;
    ELSIF TG_OP = 'INSERT' THEN
      NEW.city := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_seller_admin_fields ON public.sellers;
CREATE TRIGGER trg_protect_seller_admin_fields
  BEFORE INSERT OR UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.protect_seller_admin_fields();

-- 4. Propagate seller city changes to their products
DROP TRIGGER IF EXISTS trg_propagate_seller_city ON public.sellers;
CREATE TRIGGER trg_propagate_seller_city
  AFTER UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.propagate_seller_city();