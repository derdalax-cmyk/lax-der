-- Allow approved sellers to upload/manage product images in the "products" bucket.
-- Product image paths look like "{productId}/{uuid}.ext" and seller logos like "sellers/{user_id}/...".
-- The avatars folder ("avatars/{user_id}/...") remains covered by its own policies.

CREATE POLICY "Approved sellers upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] <> 'avatars'
    AND public.current_seller_id() IS NOT NULL
  );

CREATE POLICY "Approved sellers update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] <> 'avatars'
    AND public.current_seller_id() IS NOT NULL
  );

CREATE POLICY "Approved sellers delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] <> 'avatars'
    AND public.current_seller_id() IS NOT NULL
  );