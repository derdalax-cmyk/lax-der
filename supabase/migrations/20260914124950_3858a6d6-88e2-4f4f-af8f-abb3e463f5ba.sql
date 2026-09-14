CREATE OR REPLACE FUNCTION public.is_active_collaborator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seller_collaborators sc
    JOIN public.sellers s ON s.id = sc.seller_id
    WHERE sc.user_id = auth.uid()
      AND sc.status = 'active'
      AND s.status = 'approved'
      AND s.is_blocked = false
      AND ('products.create' = ANY (sc.permissions) OR 'products.update' = ANY (sc.permissions))
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_collaborator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_collaborator() TO authenticated, service_role;

CREATE POLICY "Collaborators upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products'
    AND (storage.foldername(name))[1] = 'sellers'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_active_collaborator());

CREATE POLICY "Collaborators update product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'products'
    AND (storage.foldername(name))[1] = 'sellers'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_active_collaborator())
  WITH CHECK (bucket_id = 'products'
    AND (storage.foldername(name))[1] = 'sellers'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_active_collaborator());

CREATE POLICY "Collaborators delete product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'products'
    AND (storage.foldername(name))[1] = 'sellers'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_active_collaborator());