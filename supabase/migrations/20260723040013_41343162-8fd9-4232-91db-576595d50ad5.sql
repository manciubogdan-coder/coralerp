
-- Access control table (same pattern as evidenta_andrada_access)
CREATE TABLE public.traction_tracker_access (
  user_id UUID PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traction_tracker_access TO anon, authenticated;
GRANT ALL ON public.traction_tracker_access TO service_role;
ALTER TABLE public.traction_tracker_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view tt access" ON public.traction_tracker_access FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tt access" ON public.traction_tracker_access FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete tt access" ON public.traction_tracker_access FOR DELETE USING (true);

-- Trackers: one per user, per department
CREATE TABLE public.traction_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  owner_email TEXT,
  owner_name TEXT,
  department TEXT NOT NULL,
  name TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'weekly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traction_trackers TO anon, authenticated;
GRANT ALL ON public.traction_trackers TO service_role;
ALTER TABLE public.traction_trackers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view trackers" ON public.traction_trackers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert trackers" ON public.traction_trackers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update trackers" ON public.traction_trackers FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete trackers" ON public.traction_trackers FOR DELETE USING (true);

-- Strategic objectives (nivel 1)
CREATE TABLE public.traction_strategic_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id UUID NOT NULL REFERENCES public.traction_trackers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  year INT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traction_strategic_objectives TO anon, authenticated;
GRANT ALL ON public.traction_strategic_objectives TO service_role;
ALTER TABLE public.traction_strategic_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage strategic" ON public.traction_strategic_objectives FOR ALL USING (true) WITH CHECK (true);

-- KPIs (nivel 2)
CREATE TABLE public.traction_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategic_id UUID NOT NULL REFERENCES public.traction_strategic_objectives(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT,
  target_value NUMERIC,
  target_operator TEXT NOT NULL DEFAULT 'gte',
  threshold_green NUMERIC,
  threshold_yellow NUMERIC,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traction_kpis TO anon, authenticated;
GRANT ALL ON public.traction_kpis TO service_role;
ALTER TABLE public.traction_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage kpis" ON public.traction_kpis FOR ALL USING (true) WITH CHECK (true);

-- KPI values per perioada
CREATE TABLE public.traction_kpi_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES public.traction_kpis(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  period_start DATE,
  value NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traction_kpi_values TO anon, authenticated;
GRANT ALL ON public.traction_kpi_values TO service_role;
ALTER TABLE public.traction_kpi_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage kpi values" ON public.traction_kpi_values FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_traction_kpi_values_kpi ON public.traction_kpi_values(kpi_id);

-- Operational objectives (nivel 3) — actiuni saptamanale
CREATE TABLE public.traction_operational_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id UUID NOT NULL REFERENCES public.traction_trackers(id) ON DELETE CASCADE,
  kpi_id UUID REFERENCES public.traction_kpis(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  action TEXT,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'open',
  period_label TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traction_operational_objectives TO anon, authenticated;
GRANT ALL ON public.traction_operational_objectives TO service_role;
ALTER TABLE public.traction_operational_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage operational" ON public.traction_operational_objectives FOR ALL USING (true) WITH CHECK (true);
