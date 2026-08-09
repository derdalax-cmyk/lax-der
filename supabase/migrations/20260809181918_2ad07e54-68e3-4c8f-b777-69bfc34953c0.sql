DROP POLICY IF EXISTS "user-private admin support write" ON storage.objects;
CREATE POLICY "user-private admin support write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-private'
  AND (storage.foldername(name))[1] = 'support'
  AND has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "user-private admin support delete" ON storage.objects;
CREATE POLICY "user-private admin support delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-private'
  AND (storage.foldername(name))[1] = 'support'
  AND has_role(auth.uid(), 'admin')
);