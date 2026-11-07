CREATE TABLE public.argus_price_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rules jsonb NOT NULL,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.argus_price_rules TO service_role;
ALTER TABLE public.argus_price_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX argus_price_rules_created_idx ON public.argus_price_rules (created_at DESC);
COMMENT ON TABLE public.argus_price_rules IS 'Server-only, append-only history of the price calculator rules; the latest row is the active set.';