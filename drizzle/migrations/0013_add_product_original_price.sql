ALTER TABLE public.products
ADD COLUMN original_price numeric NULL;

ALTER TABLE public.products
ADD CONSTRAINT products_original_price_nonnegative
CHECK (original_price IS NULL OR original_price >= 0);