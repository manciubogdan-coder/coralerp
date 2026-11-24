CREATE TABLE public.achizitii_preturi_furnizori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  data jsonb NOT NULL
);
GRANT ALL ON public.achizitii_preturi_furnizori TO service_role;
ALTER TABLE public.achizitii_preturi_furnizori ENABLE ROW LEVEL SECURITY;