REVOKE ALL ON FUNCTION public.trg_recalc_order_totals() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_recalc_order_totals() TO service_role;