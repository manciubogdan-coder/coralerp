DROP POLICY IF EXISTS horeca_group_names_read ON public.productie_horeca_grupe;
REVOKE ALL ON public.productie_horeca_grupe FROM anon, authenticated;
GRANT ALL ON public.productie_horeca_grupe TO service_role;
ALTER TABLE public.productie_horeca_grupe ENABLE ROW LEVEL SECURITY;