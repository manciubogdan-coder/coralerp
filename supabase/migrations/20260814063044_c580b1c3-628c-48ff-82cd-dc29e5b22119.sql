CREATE TABLE public.depozit_mp_intrari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  produs_nume text NOT NULL,
  produs_id text,
  cantitate numeric NOT NULL DEFAULT 0,
  unitate text NOT NULL DEFAULT 'kg',
  lot text,
  furnizor text,
  document text,
  observatii text,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.depozit_mp_intrari TO anon, authenticated;
GRANT ALL ON public.depozit_mp_intrari TO service_role;
ALTER TABLE public.depozit_mp_intrari ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depozit_mp_intrari_all" ON public.depozit_mp_intrari FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.depozit_mp_iesiri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  produs_nume text NOT NULL,
  produs_id text,
  cantitate numeric NOT NULL DEFAULT 0,
  unitate text NOT NULL DEFAULT 'kg',
  lot text,
  client text,
  document text,
  observatii text,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.depozit_mp_iesiri TO anon, authenticated;
GRANT ALL ON public.depozit_mp_iesiri TO service_role;
ALTER TABLE public.depozit_mp_iesiri ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depozit_mp_iesiri_all" ON public.depozit_mp_iesiri FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_depozit_mp_intrari_occurred ON public.depozit_mp_intrari(occurred_at DESC);
CREATE INDEX idx_depozit_mp_iesiri_occurred ON public.depozit_mp_iesiri(occurred_at DESC);

CREATE TRIGGER trg_depozit_mp_intrari_updated BEFORE UPDATE ON public.depozit_mp_intrari FOR EACH ROW EXECUTE FUNCTION public.poi_set_updated_at();
CREATE TRIGGER trg_depozit_mp_iesiri_updated BEFORE UPDATE ON public.depozit_mp_iesiri FOR EACH ROW EXECUTE FUNCTION public.poi_set_updated_at();