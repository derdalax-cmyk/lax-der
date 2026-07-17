
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS document_front_url text,
  ADD COLUMN IF NOT EXISTS document_back_url text,
  ADD COLUMN IF NOT EXISTS document_selfie_url text,
  ADD COLUMN IF NOT EXISTS face_photo_url text,
  ADD COLUMN IF NOT EXISTS emola_number text,
  ADD COLUMN IF NOT EXISTS mpesa_number text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS sellers_document_number_key
  ON public.sellers (lower(document_number))
  WHERE document_number IS NOT NULL;

-- Storage policies for private buckets (buckets created via tool)
-- seller-documents: owner (user_id folder prefix) can upload/read own; admins read all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='seller-docs owner insert') THEN
    CREATE POLICY "seller-docs owner insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id IN ('seller-documents','seller-photos') AND (auth.uid()::text = (storage.foldername(name))[1]));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='seller-docs owner select') THEN
    CREATE POLICY "seller-docs owner select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id IN ('seller-documents','seller-photos') AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='seller-docs owner update') THEN
    CREATE POLICY "seller-docs owner update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id IN ('seller-documents','seller-photos') AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='seller-docs owner delete') THEN
    CREATE POLICY "seller-docs owner delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id IN ('seller-documents','seller-photos') AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
