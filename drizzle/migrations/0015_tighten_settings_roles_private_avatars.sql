DROP POLICY IF EXISTS "Anyone view settings" ON public.app_settings;
CREATE POLICY "Admins view settings" ON public.app_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated read roles" ON public.collaborator_roles;
CREATE POLICY "Staff read roles" ON public.collaborator_roles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.current_seller_id() IS NOT NULL
  OR EXISTS (SELECT 1 FROM public.seller_collaborators sc WHERE sc.user_id = auth.uid())
);

DROP POLICY IF EXISTS "user-private read" ON storage.objects;
CREATE POLICY "user-private read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'user-private'
  AND (storage.foldername(name))[1] IN ('avatars','support')
  AND (
    (storage.foldername(name))[2] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      (storage.foldername(name))[1] = 'avatars'
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (c.buyer_id = auth.uid() AND (c.seller_user_id)::text = (storage.foldername(objects.name))[2])
           OR (c.seller_user_id = auth.uid() AND (c.buyer_id)::text = (storage.foldername(objects.name))[2])
      )
    )
  )
);