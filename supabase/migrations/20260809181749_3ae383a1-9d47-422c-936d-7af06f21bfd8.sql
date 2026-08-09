-- Owner-scoped writes in user-private (avatars/<uid>/... and support/<uid>/...)
DROP POLICY IF EXISTS "user-private owner insert" ON storage.objects;
CREATE POLICY "user-private owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-private'
  AND (storage.foldername(name))[1] IN ('avatars', 'support')
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "user-private owner update" ON storage.objects;
CREATE POLICY "user-private owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'user-private'
  AND (storage.foldername(name))[1] IN ('avatars', 'support')
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'user-private'
  AND (storage.foldername(name))[1] IN ('avatars', 'support')
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "user-private owner delete" ON storage.objects;
CREATE POLICY "user-private owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-private'
  AND (storage.foldername(name))[1] IN ('avatars', 'support')
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Reads: avatars readable by signed-in users (chat/reviews show other people's avatars);
-- support attachments only by the owner or admins.
DROP POLICY IF EXISTS "user-private read" ON storage.objects;
CREATE POLICY "user-private read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'user-private'
  AND (
    (storage.foldername(name))[1] = 'avatars'
    OR (
      (storage.foldername(name))[1] = 'support'
      AND (
        (storage.foldername(name))[2] = auth.uid()::text
        OR has_role(auth.uid(), 'admin')
      )
    )
  )
);