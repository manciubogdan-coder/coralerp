-- Tabel pentru datele manuale ale raportului de recepție
CREATE TABLE public.reception_report_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID NOT NULL UNIQUE,
  inventory_type TEXT NOT NULL DEFAULT 'materii_prime',
  paleti_lazi_document TEXT,
  cantitate_receptionata NUMERIC,
  tip_lada_culoare TEXT,
  tip_palet TEXT,
  nr_lazi INTEGER,
  pierdere_calitativa_procent NUMERIC,
  transmis_la_furnizor BOOLEAN DEFAULT false,
  observatii TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_reception_report_inventory ON public.reception_report_data(inventory_id);

ALTER TABLE public.reception_report_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reception report data"
  ON public.reception_report_data FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert reception report data"
  ON public.reception_report_data FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update reception report data"
  ON public.reception_report_data FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated can delete reception report data"
  ON public.reception_report_data FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER update_reception_report_data_updated_at
  BEFORE UPDATE ON public.reception_report_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();