CREATE TABLE public.productie_horeca_grupe (id boolean PRIMARY KEY DEFAULT true CHECK (id), groups jsonb NOT NULL CHECK (jsonb_typeof(groups) = 'array'), version integer NOT NULL DEFAULT 1);
GRANT SELECT ON public.productie_horeca_grupe TO anon, authenticated;
GRANT ALL ON public.productie_horeca_grupe TO service_role;
ALTER TABLE public.productie_horeca_grupe ENABLE ROW LEVEL SECURITY;
CREATE POLICY horeca_group_names_read ON public.productie_horeca_grupe FOR SELECT TO anon, authenticated USING (true);