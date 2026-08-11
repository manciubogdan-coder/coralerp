CREATE TABLE public.planner_personal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nume text NOT NULL,
  linie_id text,
  linie_nume text,
  post text,
  status text NOT NULL DEFAULT 'activ',
  status_note text,
  status_from date,
  status_to date,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_personal TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_personal TO authenticated;
GRANT ALL ON public.planner_personal TO service_role;

ALTER TABLE public.planner_personal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_personal_all" ON public.planner_personal FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER planner_personal_updated_at BEFORE UPDATE ON public.planner_personal
FOR EACH ROW EXECUTE FUNCTION public.poi_set_updated_at();