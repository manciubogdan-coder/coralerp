ALTER TABLE public.prereceptie_linii
  ADD COLUMN IF NOT EXISTS missing_at timestamptz,
  ADD COLUMN IF NOT EXISTS missing_by_email text,
  ADD COLUMN IF NOT EXISTS missing_reason text;
CREATE INDEX IF NOT EXISTS idx_prereceptie_linii_missing ON public.prereceptie_linii(missing_at) WHERE missing_at IS NOT NULL;