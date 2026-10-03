CREATE TABLE public.packaging_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 120),
  client_order integer NOT NULL DEFAULT 0,
  subgroup text CHECK (subgroup IS NULL OR char_length(subgroup) <= 160),
  product_name text NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 160),
  weight text NOT NULL CHECK (char_length(weight) BETWEEN 1 AND 40),
  primary_packaging text NOT NULL CHECK (char_length(primary_packaging) BETWEEN 1 AND 160),
  tertiary_packaging text NOT NULL CHECK (char_length(tertiary_packaging) BETWEEN 1 AND 160),
  units_per_case text NOT NULL CHECK (char_length(units_per_case) BETWEEN 1 AND 40),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.packaging_methods TO service_role;
ALTER TABLE public.packaging_methods ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.set_packaging_methods_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_packaging_methods_updated_at
BEFORE UPDATE ON public.packaging_methods
FOR EACH ROW EXECUTE FUNCTION public.set_packaging_methods_updated_at();