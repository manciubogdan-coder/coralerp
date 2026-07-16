
CREATE TABLE public.evidenta_andrada_access (
  user_id uuid PRIMARY KEY,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidenta_andrada_access TO anon, authenticated;
GRANT ALL ON public.evidenta_andrada_access TO service_role;
ALTER TABLE public.evidenta_andrada_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view" ON public.evidenta_andrada_access FOR SELECT USING (true);
CREATE POLICY "Anyone can insert" ON public.evidenta_andrada_access FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete" ON public.evidenta_andrada_access FOR DELETE USING (true);
