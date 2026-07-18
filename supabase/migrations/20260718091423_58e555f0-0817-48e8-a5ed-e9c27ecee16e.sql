DROP POLICY IF EXISTS "Users can create own seller application" ON public.sellers;
CREATE POLICY "Users can create own seller application" ON public.sellers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);