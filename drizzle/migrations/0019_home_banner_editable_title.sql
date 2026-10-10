ALTER TABLE public.home_banners ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Conectamos-te ao que procuras.';
ALTER TABLE public.home_banners ADD CONSTRAINT home_banners_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 120);
COMMENT ON COLUMN public.home_banners.title IS 'Admin-editable main heading displayed with this banner on the homepage.';