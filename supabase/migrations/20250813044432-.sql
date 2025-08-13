-- Update consider quantity functions to include product pt_percent in calculation

CREATE OR REPLACE FUNCTION public.recalc_consider_quantity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  base_qty numeric;
  pt numeric := 0;
BEGIN
  -- base from snapshot
  SELECT COALESCE(s.net_quantity, s.quantity) INTO base_qty
  FROM public.daily_stock_snapshots s
  WHERE s.id = NEW.snapshot_id;

  IF base_qty IS NULL THEN
    base_qty := 0;
  END IF;
  -- fetch % PT from product
  SELECT COALESCE(p.pt_percent, 0) INTO pt
  FROM public.daily_stock_snapshots s
  LEFT JOIN public.products p ON p.id = s.product_id
  WHERE s.id = NEW.snapshot_id;

  NEW.consider_quantity := GREATEST(
    0,
    base_qty * (1 - COALESCE(NEW.nonconform_percent, 0) / 100.0) * (1 - COALESCE(pt, 0) / 100.0)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_consider_quantity_ambalaje()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  base_qty numeric;
  pt numeric := 0;
BEGIN
  SELECT COALESCE(s.net_quantity, s.quantity) INTO base_qty
  FROM public.ambalaje_daily_stock_snapshots s
  WHERE s.id = NEW.snapshot_id;

  IF base_qty IS NULL THEN
    base_qty := 0;
  END IF;

  SELECT COALESCE(p.pt_percent, 0) INTO pt
  FROM public.ambalaje_daily_stock_snapshots s
  LEFT JOIN public.ambalaje_products p ON p.id = s.product_id
  WHERE s.id = NEW.snapshot_id;

  NEW.consider_quantity := GREATEST(
    0,
    base_qty * (1 - COALESCE(NEW.nonconform_percent, 0) / 100.0) * (1 - COALESCE(pt, 0) / 100.0)
  );
  RETURN NEW;
END;
$function$;