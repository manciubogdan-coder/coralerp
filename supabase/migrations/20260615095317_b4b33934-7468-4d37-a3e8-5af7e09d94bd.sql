CREATE TABLE public.reception_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id uuid NOT NULL,
  reception_table text NOT NULL,
  inventory_type text NOT NULL,
  user_id uuid,
  user_email text,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reception_audit_log_reception_id ON public.reception_audit_log (reception_id);
CREATE INDEX idx_reception_audit_log_created_at ON public.reception_audit_log (created_at DESC);

GRANT SELECT, INSERT ON public.reception_audit_log TO authenticated;
GRANT ALL ON public.reception_audit_log TO service_role;

ALTER TABLE public.reception_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read audit log"
  ON public.reception_audit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert their own audit entries"
  ON public.reception_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);