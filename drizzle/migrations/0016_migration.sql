CREATE TABLE public.argus_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('comanda_productie','comanda_client','comanda_furnizor','task')),
  summary text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','cancelled','error')),
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
ALTER TABLE public.argus_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.argus_actions FROM anon, authenticated;
GRANT ALL ON public.argus_actions TO service_role;