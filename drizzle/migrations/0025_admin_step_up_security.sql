CREATE TABLE public.admin_webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports jsonb NOT NULL DEFAULT '[]'::jsonb,
  device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX admin_webauthn_credentials_user_idx ON public.admin_webauthn_credentials(user_id);
GRANT ALL ON public.admin_webauthn_credentials TO service_role;
ALTER TABLE public.admin_webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('register','authenticate')),
  rp_id text NOT NULL,
  origin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  consumed_at timestamptz,
  CHECK (expires_at <= created_at + interval '5 minutes')
);
CREATE INDEX admin_webauthn_challenges_user_idx ON public.admin_webauthn_challenges(user_id, purpose, consumed_at);
GRANT ALL ON public.admin_webauthn_challenges TO service_role;
ALTER TABLE public.admin_webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_verified_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  auth_method text NOT NULL CHECK (auth_method IN ('passkey','recovery_code')),
  session_nonce_hash text NOT NULL UNIQUE,
  revoked_at timestamptz,
  last_seen_at timestamptz
);
CREATE INDEX admin_verified_sessions_user_idx ON public.admin_verified_sessions(user_id);
GRANT ALL ON public.admin_verified_sessions TO service_role;
ALTER TABLE public.admin_verified_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX admin_recovery_codes_user_idx ON public.admin_recovery_codes(user_id);
GRANT ALL ON public.admin_recovery_codes TO service_role;
ALTER TABLE public.admin_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Gestão de admins passa a ser feita apenas via servidor (Super Admin).
REVOKE EXECUTE ON FUNCTION public.grant_admin_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_admin_by_email(text) FROM PUBLIC, anon, authenticated;

-- admin_allowlist deixa de ser lida pelo frontend e de promover automaticamente.
REVOKE ALL ON public.admin_allowlist FROM anon, authenticated;
COMMENT ON TABLE public.admin_allowlist IS 'DEPRECATED: user_roles is the source of truth; admin grants happen via Super Admin server functions.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.id,
      'welcome',
      'Bem-vindo à DERDALAX',
      'Encontre peças únicas selecionadas para si. Explore a nossa coleção e descubra o seu estilo.',
      '/'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'welcome notification failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;