ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_provider_id TEXT;
CREATE INDEX IF NOT EXISTS orders_payment_provider_id_idx ON public.orders(payment_provider_id);