CREATE TABLE public.inventar_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_type text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_by_email text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventar_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.inventar_sessions(id) ON DELETE CASCADE,
  inventory_row_id uuid,
  name text NOT NULL,
  lot_number text,
  supplier text,
  manufacturer text,
  unit text,
  scriptic numeric NOT NULL DEFAULT 0,
  fizic numeric,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventar_items_session ON public.inventar_session_items(session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventar_sessions TO anon, authenticated;
GRANT ALL ON public.inventar_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventar_session_items TO anon, authenticated;
GRANT ALL ON public.inventar_session_items TO service_role;

ALTER TABLE public.inventar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventar_session_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view inventar sessions" ON public.inventar_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert inventar sessions" ON public.inventar_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update inventar sessions" ON public.inventar_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete inventar sessions" ON public.inventar_sessions FOR DELETE USING (true);

CREATE POLICY "Anyone can view inventar items" ON public.inventar_session_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert inventar items" ON public.inventar_session_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update inventar items" ON public.inventar_session_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete inventar items" ON public.inventar_session_items FOR DELETE USING (true);