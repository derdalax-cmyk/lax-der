-- Featured collections (home sections / destaques)
CREATE TABLE public.featured_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.featured_collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.featured_collections TO authenticated;
GRANT ALL ON public.featured_collections TO service_role;

ALTER TABLE public.featured_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "featured_collections_select_all"
  ON public.featured_collections FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "featured_collections_admin_insert"
  ON public.featured_collections FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "featured_collections_admin_update"
  ON public.featured_collections FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "featured_collections_admin_delete"
  ON public.featured_collections FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_featured_collections_updated_at
  BEFORE UPDATE ON public.featured_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Join table: products inside each featured collection, with manual ordering
CREATE TABLE public.featured_collection_products (
  collection_id uuid NOT NULL REFERENCES public.featured_collections(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, product_id)
);

GRANT SELECT ON public.featured_collection_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.featured_collection_products TO authenticated;
GRANT ALL ON public.featured_collection_products TO service_role;

ALTER TABLE public.featured_collection_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fcp_select_all"
  ON public.featured_collection_products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "fcp_admin_insert"
  ON public.featured_collection_products FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fcp_admin_update"
  ON public.featured_collection_products FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fcp_admin_delete"
  ON public.featured_collection_products FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_fcp_collection ON public.featured_collection_products(collection_id, sort_order);
CREATE INDEX idx_fcp_product ON public.featured_collection_products(product_id);