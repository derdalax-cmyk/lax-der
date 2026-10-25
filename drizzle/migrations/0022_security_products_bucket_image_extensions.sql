-- Bucket products: apenas extensões de imagem seguras (bloqueia SVG/HTML/JS mesmo com cliente modificado)
DROP POLICY "Admins upload product images" ON storage.objects;
CREATE POLICY "Admins upload product images"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'products'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND lower(name) ~ '\.(jpe?g|png|webp)$'
);

DROP POLICY "Approved sellers upload product images" ON storage.objects;
CREATE POLICY "Approved sellers upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'products'
  AND public.current_seller_id() IS NOT NULL
  AND lower(name) ~ '\.(jpe?g|png|webp)$'
  AND (
    ((storage.foldername(name))[1] = 'sellers' AND (storage.foldername(name))[2] = (auth.uid())::text)
    OR EXISTS (
      SELECT 1 FROM public.products p
       WHERE (p.id)::text = (storage.foldername(name))[1]
         AND p.seller_id = public.current_seller_id()
    )
  )
);
