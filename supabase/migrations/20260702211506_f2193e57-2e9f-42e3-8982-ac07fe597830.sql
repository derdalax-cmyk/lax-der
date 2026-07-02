ALTER TABLE public.sellers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sellers;