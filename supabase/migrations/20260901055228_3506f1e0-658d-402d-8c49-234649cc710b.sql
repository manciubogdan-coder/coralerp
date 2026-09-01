CREATE TABLE public.ggn_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('supplier','manufacturer')),
  inventory_type text NOT NULL,
  name_key text NOT NULL,
  display_name text,
  ggn_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, inventory_type, name_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ggn_codes TO authenticated;
GRANT SELECT ON public.ggn_codes TO anon;
GRANT ALL ON public.ggn_codes TO service_role;

ALTER TABLE public.ggn_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ggn_codes readable by everyone" ON public.ggn_codes FOR SELECT USING (true);
CREATE POLICY "ggn_codes writable by authenticated" ON public.ggn_codes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ggn_codes updatable by authenticated" ON public.ggn_codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ggn_codes deletable by authenticated" ON public.ggn_codes FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_ggn_codes_updated_at BEFORE UPDATE ON public.ggn_codes
FOR EACH ROW EXECUTE FUNCTION public.poi_set_updated_at();