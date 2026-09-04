CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.is_vip := OLD.is_vip;
    NEW.blocked := OLD.blocked;
    NEW.admin_notes := OLD.admin_notes;
    NEW.id := OLD.id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_profile_admin_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_admin_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_fields();

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
      NEW.verified_at := OLD.verified_at;
      NEW.admin_notes := OLD.admin_notes;
      NEW.is_blocked := OLD.is_blocked;
      NEW.city := OLD.city;
      NEW.rating := OLD.rating;
      NEW.total_reviews := OLD.total_reviews;
      NEW.user_id := OLD.user_id;
    ELSIF TG_OP = 'INSERT' THEN
      NEW.city := NULL;
      NEW.verified_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;