CREATE OR REPLACE FUNCTION public.protect_seller_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := OLD.status;
    NEW.approved_at := OLD.approved_at;
    NEW.admin_notes := OLD.admin_notes;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_seller_admin_fields ON public.sellers;
CREATE TRIGGER trg_protect_seller_admin_fields
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.protect_seller_admin_fields();