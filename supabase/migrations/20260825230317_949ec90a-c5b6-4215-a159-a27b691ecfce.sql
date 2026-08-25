-- Allow orders and sellers to survive (anonymized) after account deletion
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.orders DROP CONSTRAINT orders_user_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.sellers ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.sellers DROP CONSTRAINT sellers_user_id_fkey;
ALTER TABLE public.sellers ADD CONSTRAINT sellers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Verification codes for account deletion (server-only)
CREATE TABLE public.account_deletion_codes (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.account_deletion_codes TO service_role;

ALTER TABLE public.account_deletion_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to deletion codes"
  ON public.account_deletion_codes FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER account_deletion_codes_updated_at
  BEFORE UPDATE ON public.account_deletion_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();