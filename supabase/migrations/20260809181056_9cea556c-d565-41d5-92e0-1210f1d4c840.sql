DROP POLICY IF EXISTS "Approved sellers upload product images" ON storage.objects;
CREATE POLICY "Approved sellers upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'products'
  AND current_seller_id() IS NOT NULL
  AND (
    ((storage.foldername(name))[1] = 'sellers' AND (storage.foldername(name))[2] = auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.seller_id = current_seller_id()
    )
  )
);

DROP POLICY IF EXISTS "Approved sellers update product images" ON storage.objects;
CREATE POLICY "Approved sellers update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'products'
  AND current_seller_id() IS NOT NULL
  AND (
    ((storage.foldername(name))[1] = 'sellers' AND (storage.foldername(name))[2] = auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.seller_id = current_seller_id()
    )
  )
)
WITH CHECK (
  bucket_id = 'products'
  AND current_seller_id() IS NOT NULL
  AND (
    ((storage.foldername(name))[1] = 'sellers' AND (storage.foldername(name))[2] = auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.seller_id = current_seller_id()
    )
  )
);