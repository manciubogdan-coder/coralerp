DROP POLICY IF EXISTS "Read hall layout" ON public.viziune_hala_layout;
REVOKE ALL ON public.viziune_hala_layout FROM anon, authenticated;
GRANT ALL ON public.viziune_hala_layout TO service_role;
COMMENT ON TABLE public.viziune_hala_layout IS 'Server-only: read and saved through argus viziune_layout / viziune_layout_save (admin-validated).';