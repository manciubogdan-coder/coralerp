CREATE TABLE public.viziune_hala_layout (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  stations jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.viziune_hala_layout TO anon, authenticated;
GRANT ALL ON public.viziune_hala_layout TO service_role;
ALTER TABLE public.viziune_hala_layout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read hall layout" ON public.viziune_hala_layout FOR SELECT TO anon, authenticated USING (true);