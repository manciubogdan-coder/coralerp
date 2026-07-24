
CREATE TABLE public.traction_strategic_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategic_id uuid NOT NULL REFERENCES public.traction_strategic_objectives(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_label text,
  progress numeric,
  status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traction_strategic_progress TO authenticated;
GRANT ALL ON public.traction_strategic_progress TO service_role;
ALTER TABLE public.traction_strategic_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage strategic progress" ON public.traction_strategic_progress FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.traction_operational_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_id uuid NOT NULL REFERENCES public.traction_operational_objectives(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_label text,
  progress numeric,
  status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traction_operational_progress TO authenticated;
GRANT ALL ON public.traction_operational_progress TO service_role;
ALTER TABLE public.traction_operational_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage operational progress" ON public.traction_operational_progress FOR ALL USING (true) WITH CHECK (true);
