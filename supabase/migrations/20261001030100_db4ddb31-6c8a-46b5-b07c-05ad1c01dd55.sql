CREATE TABLE public.argus_report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  prompt_instructions text NOT NULL,
  preferred_widget_type text NOT NULL DEFAULT 'auto',
  schedule_type text NOT NULL DEFAULT 'on_demand',
  is_public boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  created_by_name text,
  last_scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.argus_report_templates TO service_role;
ALTER TABLE public.argus_report_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server only" ON public.argus_report_templates FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

CREATE TABLE public.argus_generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.argus_report_templates(id) ON DELETE CASCADE,
  content_json jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  executed_at timestamptz NOT NULL DEFAULT now(),
  execution_type text NOT NULL DEFAULT 'manual'
);
CREATE INDEX ON public.argus_generated_reports (template_id, executed_at DESC);
GRANT ALL ON public.argus_generated_reports TO service_role;
ALTER TABLE public.argus_generated_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server only" ON public.argus_generated_reports FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

CREATE TABLE public.argus_user_dashboard_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  template_id uuid NOT NULL REFERENCES public.argus_report_templates(id) ON DELETE CASCADE,
  position_order integer NOT NULL DEFAULT 0,
  column_span integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id)
);
GRANT ALL ON public.argus_user_dashboard_cards TO service_role;
ALTER TABLE public.argus_user_dashboard_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server only" ON public.argus_user_dashboard_cards FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

CREATE TABLE public.argus_job_state (
  job text PRIMARY KEY,
  locked_until timestamptz,
  paused_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.argus_job_state TO service_role;
ALTER TABLE public.argus_job_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server only" ON public.argus_job_state FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);