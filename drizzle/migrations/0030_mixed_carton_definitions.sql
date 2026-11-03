CREATE TABLE public.productie_baxuri_mixte (
 produs_id uuid PRIMARY KEY,
 denumire text NOT NULL,
 aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
 components jsonb NOT NULL DEFAULT '[]'::jsonb,
 enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.productie_baxuri_mixte TO anon, authenticated;
GRANT ALL ON public.productie_baxuri_mixte TO service_role;
ALTER TABLE public.productie_baxuri_mixte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read public carton catalog" ON public.productie_baxuri_mixte FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.productie_baxuri_importuri (
 source_key text PRIMARY KEY,
 definition jsonb NOT NULL,
 source_quantity numeric NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.productie_baxuri_importuri TO service_role;
ALTER TABLE public.productie_baxuri_importuri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanzari_necesar_linii ADD COLUMN IF NOT EXISTS carton_group text, ADD COLUMN IF NOT EXISTS carton_source text, ADD COLUMN IF NOT EXISTS carton_quantity numeric, ADD COLUMN IF NOT EXISTS carton_units numeric;
