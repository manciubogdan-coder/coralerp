-- ============================================================
-- Senior ERP integration — RULEAZĂ ACEST SCRIPT ÎN LEGACY DB
-- Proiect: mfcdlifjxxdrekzdatfb (SQL Editor)
-- ============================================================
-- Se poate rula de mai multe ori în siguranță (IF NOT EXISTS).

-- 1) Extindere productie_comenzi
ALTER TABLE public.productie_comenzi
  ADD COLUMN IF NOT EXISTS sursa TEXT,
  ADD COLUMN IF NOT EXISTS extern_nr_aviz TEXT,
  ADD COLUMN IF NOT EXISTS extern_data_aviz DATE;

-- Index unic pentru deduplicare avize din surse externe
CREATE UNIQUE INDEX IF NOT EXISTS idx_productie_comenzi_extern_unique
  ON public.productie_comenzi (sursa, extern_nr_aviz)
  WHERE sursa IS NOT NULL AND extern_nr_aviz IS NOT NULL;

-- 2) Tabel mapping produse ERP → produs intern
CREATE TABLE IF NOT EXISTS public.erp_mapping_produse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_extern TEXT NOT NULL,
  denumire_extern TEXT,
  produs_id UUID NOT NULL REFERENCES public.productie_produse(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cod_extern)
);

ALTER TABLE public.erp_mapping_produse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_mapping_all" ON public.erp_mapping_produse;
CREATE POLICY "erp_mapping_all" ON public.erp_mapping_produse
  FOR ALL USING (true) WITH CHECK (true);

-- 3) Tabel mapping magazine (opțional — dacă numele nu se potrivesc exact)
CREATE TABLE IF NOT EXISTS public.erp_mapping_magazine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_extern TEXT NOT NULL,
  denumire_extern TEXT,
  nume_magazin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cod_extern)
);

ALTER TABLE public.erp_mapping_magazine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_mapping_magazine_all" ON public.erp_mapping_magazine;
CREATE POLICY "erp_mapping_magazine_all" ON public.erp_mapping_magazine
  FOR ALL USING (true) WITH CHECK (true);

-- 4) Tabel log rulări bridge
CREATE TABLE IF NOT EXISTS public.erp_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  avize_primite INT NOT NULL DEFAULT 0,
  comenzi_create INT NOT NULL DEFAULT 0,
  linii_create INT NOT NULL DEFAULT 0,
  skipped_duplicat INT NOT NULL DEFAULT 0,
  unmapped_produse JSONB NOT NULL DEFAULT '[]'::jsonb,
  unmapped_magazine JSONB NOT NULL DEFAULT '[]'::jsonb,
  erori JSONB NOT NULL DEFAULT '[]'::jsonb,
  bridge_version TEXT,
  bridge_host TEXT
);

ALTER TABLE public.erp_import_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_import_log_all" ON public.erp_import_log;
CREATE POLICY "erp_import_log_all" ON public.erp_import_log
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_erp_import_log_ran_at
  ON public.erp_import_log (ran_at DESC);

-- 5) Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS erp_mapping_produse_updated_at ON public.erp_mapping_produse;
CREATE TRIGGER erp_mapping_produse_updated_at
  BEFORE UPDATE ON public.erp_mapping_produse
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();
