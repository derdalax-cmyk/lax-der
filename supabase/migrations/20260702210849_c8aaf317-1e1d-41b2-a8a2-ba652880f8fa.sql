-- Sellers (vendedores) table
CREATE TABLE public.sellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  store_name TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT,
  description TEXT,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sellers TO authenticated;
GRANT ALL ON public.sellers TO service_role;

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- Users can view their own seller record
CREATE POLICY "Users can view own seller record"
ON public.sellers FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Users can create their own seller application (only as pending)
CREATE POLICY "Users can create own seller application"
ON public.sellers FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Users can update their own store details (not status), admins can update anything
CREATE POLICY "Users update own seller record"
ON public.sellers FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any seller"
ON public.sellers FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sellers"
ON public.sellers FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER set_sellers_updated_at
BEFORE UPDATE ON public.sellers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();