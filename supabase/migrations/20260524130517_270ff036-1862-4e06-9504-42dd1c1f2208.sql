-- Tabel pentru trasabilitatea materiilor prime / ambalajelor / etichetelor
-- scanate înainte sau în timpul unei sesiuni de producție.
CREATE TABLE IF NOT EXISTS public.productie_trasabilitate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id uuid NOT NULL,
  sesiune_id uuid,
  tip text NOT NULL, -- 'materie_prima' | 'folie' | 'caserole' | 'cutii' | 'eticheta_produs' | 'eticheta_bax' | 'alt'
  cod text NOT NULL,
  scanned_by uuid,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prod_tras_comanda ON public.productie_trasabilitate(comanda_id);
CREATE INDEX IF NOT EXISTS idx_prod_tras_sesiune ON public.productie_trasabilitate(sesiune_id);

ALTER TABLE public.productie_trasabilitate ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trasabilitate_all_auth" ON public.productie_trasabilitate;
CREATE POLICY "trasabilitate_all_auth"
  ON public.productie_trasabilitate
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);