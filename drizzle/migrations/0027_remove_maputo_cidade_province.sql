CREATE OR REPLACE FUNCTION public.validate_profile_province()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.province IS NOT DISTINCT FROM OLD.province THEN RETURN NEW; END IF;
  IF NEW.province IS NULL OR btrim(NEW.province) = '' THEN NEW.province := NULL; RETURN NEW; END IF;
  IF NEW.province NOT IN ('Maputo Província','Gaza','Inhambane','Sofala','Manica','Tete','Zambézia','Nampula','Cabo Delgado','Niassa') THEN
    RAISE EXCEPTION 'Selecione uma província válida de Moçambique.';
  END IF;
  RETURN NEW;
END $$;