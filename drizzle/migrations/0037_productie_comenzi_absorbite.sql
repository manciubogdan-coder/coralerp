CREATE TABLE public.productie_comenzi_absorbite (
  old_id text PRIMARY KEY, new_id text NOT NULL, old_numar text, new_numar text, magazin text, produs_id text,
  data_productie date, cantitate_veche numeric, cantitate_noua numeric, produs_mutat numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.productie_comenzi_absorbite TO service_role;
ALTER TABLE public.productie_comenzi_absorbite ENABLE ROW LEVEL SECURITY;