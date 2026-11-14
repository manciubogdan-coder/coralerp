CREATE TABLE public.viziune_birouri_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  offices jsonb NOT NULL DEFAULT '{}'::jsonb,
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.viziune_birouri_config TO service_role;
ALTER TABLE public.viziune_birouri_config ENABLE ROW LEVEL SECURITY;