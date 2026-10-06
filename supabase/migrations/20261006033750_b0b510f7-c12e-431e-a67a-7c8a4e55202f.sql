CREATE TABLE public.vanzari_necesar_documente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zi date NOT NULL,
  client text NOT NULL,
  file_name text,
  nr_comanda text,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vanzari_necesar_documente TO anon, authenticated;
GRANT ALL ON public.vanzari_necesar_documente TO service_role;
ALTER TABLE public.vanzari_necesar_documente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app access docs" ON public.vanzari_necesar_documente FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.vanzari_necesar_linii (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.vanzari_necesar_documente(id) ON DELETE CASCADE,
  zi date NOT NULL,
  client text NOT NULL,
  depozit text,
  nr_comanda text,
  produs text NOT NULL,
  gramaj numeric,
  bucati numeric NOT NULL DEFAULT 0,
  taiat numeric NOT NULL DEFAULT 0,
  buc_bax numeric,
  ambalaj_primar text,
  ambalaj_tertiar text,
  produs_id text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.vanzari_necesar_linii (zi);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vanzari_necesar_linii TO anon, authenticated;
GRANT ALL ON public.vanzari_necesar_linii TO service_role;
ALTER TABLE public.vanzari_necesar_linii ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app access linii" ON public.vanzari_necesar_linii FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);