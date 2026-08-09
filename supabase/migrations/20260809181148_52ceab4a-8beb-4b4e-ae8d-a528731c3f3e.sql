DROP POLICY IF EXISTS "Users upload own support images" ON storage.objects;
CREATE POLICY "Users upload own support images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'products'
  AND (storage.foldername(name))[1] = 'support'
  AND (storage.foldername(name))[2] = auth.uid()::text
);