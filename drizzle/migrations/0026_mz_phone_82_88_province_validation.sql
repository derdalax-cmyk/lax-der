ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS province text;

CREATE OR REPLACE FUNCTION public.normalize_profile_phone()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.phone IS NOT DISTINCT FROM OLD.phone THEN RETURN NEW; END IF;
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN NEW.phone := NULL; RETURN NEW; END IF;
  v := regexp_replace(NEW.phone, '[\s\-().]', '', 'g');
  v := regexp_replace(v, '^(\+|00)?258', '');
  IF v !~ '^8[2-8][0-9]{7}$' THEN RAISE EXCEPTION 'Introduza um número moçambicano válido (+258 82–88...)'; END IF;
  NEW.phone := '+258' || v;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_profile_province()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.province IS NOT DISTINCT FROM OLD.province THEN RETURN NEW; END IF;
  IF NEW.province IS NULL OR btrim(NEW.province) = '' THEN NEW.province := NULL; RETURN NEW; END IF;
  IF NEW.province NOT IN ('Maputo Cidade','Maputo Província','Gaza','Inhambane','Sofala','Manica','Tete','Zambézia','Nampula','Cabo Delgado','Niassa') THEN
    RAISE EXCEPTION 'Selecione uma província válida de Moçambique.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_profile_province ON public.profiles;
CREATE TRIGGER trg_validate_profile_province BEFORE INSERT OR UPDATE OF province ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_province();