ALTER TABLE public.traction_strategic_objectives ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.traction_kpis ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.traction_operational_objectives ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;