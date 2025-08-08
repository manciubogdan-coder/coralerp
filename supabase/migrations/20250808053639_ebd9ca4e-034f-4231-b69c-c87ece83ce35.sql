-- Daily stock quality tables for recording quality observations and usable quantities

-- 1) Create table for produce inventory daily stock quality
CREATE TABLE IF NOT EXISTS public.daily_stock_quality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL UNIQUE REFERENCES public.daily_stock_snapshots(id) ON DELETE CASCADE,
  obs text,
  nonconform_percent numeric NOT NULL DEFAULT 0 CHECK (nonconform_percent >= 0 AND nonconform_percent <= 100),
  consider_quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Create table for ambalaje daily stock quality (for future use)
CREATE TABLE IF NOT EXISTS public.ambalaje_daily_stock_quality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL UNIQUE REFERENCES public.ambalaje_daily_stock_snapshots(id) ON DELETE CASCADE,
  obs text,
  nonconform_percent numeric NOT NULL DEFAULT 0 CHECK (nonconform_percent >= 0 AND nonconform_percent <= 100),
  consider_quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Calculation functions to (re)compute consider_quantity based on snapshot quantities
CREATE OR REPLACE FUNCTION public.recalc_consider_quantity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_qty numeric;
BEGIN
  SELECT COALESCE(s.net_quantity, s.quantity) INTO base_qty
  FROM public.daily_stock_snapshots s
  WHERE s.id = NEW.snapshot_id;

  IF base_qty IS NULL THEN
    base_qty := 0;
  END IF;

  NEW.consider_quantity := GREATEST(0, base_qty * (1 - COALESCE(NEW.nonconform_percent, 0) / 100.0));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_consider_quantity_ambalaje()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_qty numeric;
BEGIN
  SELECT COALESCE(s.net_quantity, s.quantity) INTO base_qty
  FROM public.ambalaje_daily_stock_snapshots s
  WHERE s.id = NEW.snapshot_id;

  IF base_qty IS NULL THEN
    base_qty := 0;
  END IF;

  NEW.consider_quantity := GREATEST(0, base_qty * (1 - COALESCE(NEW.nonconform_percent, 0) / 100.0));
  RETURN NEW;
END;
$$;

-- 4) Triggers to keep consider_quantity and updated_at in sync
DROP TRIGGER IF EXISTS trg_daily_stock_quality_calc ON public.daily_stock_quality;
CREATE TRIGGER trg_daily_stock_quality_calc
BEFORE INSERT OR UPDATE OF nonconform_percent ON public.daily_stock_quality
FOR EACH ROW
EXECUTE FUNCTION public.recalc_consider_quantity();

DROP TRIGGER IF EXISTS update_daily_stock_quality_updated_at ON public.daily_stock_quality;
CREATE TRIGGER update_daily_stock_quality_updated_at
BEFORE UPDATE ON public.daily_stock_quality
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ambalaje_daily_stock_quality_calc ON public.ambalaje_daily_stock_quality;
CREATE TRIGGER trg_ambalaje_daily_stock_quality_calc
BEFORE INSERT OR UPDATE OF nonconform_percent ON public.ambalaje_daily_stock_quality
FOR EACH ROW
EXECUTE FUNCTION public.recalc_consider_quantity_ambalaje();

DROP TRIGGER IF EXISTS update_ambalaje_daily_stock_quality_updated_at ON public.ambalaje_daily_stock_quality;
CREATE TRIGGER update_ambalaje_daily_stock_quality_updated_at
BEFORE UPDATE ON public.ambalaje_daily_stock_quality
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RLS: enable and allow operations (follow existing project pattern)
ALTER TABLE public.daily_stock_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_daily_stock_quality ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on daily_stock_quality" ON public.daily_stock_quality;
CREATE POLICY "Allow all operations on daily_stock_quality"
ON public.daily_stock_quality
FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on ambalaje_daily_stock_quality" ON public.ambalaje_daily_stock_quality;
CREATE POLICY "Allow all operations on ambalaje_daily_stock_quality"
ON public.ambalaje_daily_stock_quality
FOR ALL
USING (true)
WITH CHECK (true);

-- 6) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_daily_stock_quality_snapshot_id ON public.daily_stock_quality(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_ambalaje_daily_stock_quality_snapshot_id ON public.ambalaje_daily_stock_quality(snapshot_id);