CREATE TABLE public.mentenanta_utilaje (
  linie_id uuid PRIMARY KEY,
  locatie text,
  observatii text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentenanta_utilaje TO authenticated;
GRANT SELECT ON public.mentenanta_utilaje TO anon;
GRANT ALL ON public.mentenanta_utilaje TO service_role;
ALTER TABLE public.mentenanta_utilaje ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read utilaje" ON public.mentenanta_utilaje FOR SELECT USING (true);
CREATE POLICY "Anyone can insert utilaje" ON public.mentenanta_utilaje FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update utilaje" ON public.mentenanta_utilaje FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete utilaje" ON public.mentenanta_utilaje FOR DELETE USING (true);
CREATE TRIGGER trg_mentenanta_utilaje_updated BEFORE UPDATE ON public.mentenanta_utilaje FOR EACH ROW EXECUTE FUNCTION public.poi_set_updated_at();