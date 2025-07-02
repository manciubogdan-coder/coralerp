-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to generate snapshots for missing dates
CREATE OR REPLACE FUNCTION public.generate_missing_snapshots(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  snapshot_date DATE,
  items_count INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  processing_date DATE;
  response_data JSONB;
BEGIN
  processing_date := start_date;
  
  WHILE processing_date <= end_date LOOP
    -- Check if snapshot already exists
    IF NOT EXISTS (
      SELECT 1 FROM daily_stock_snapshots 
      WHERE daily_stock_snapshots.snapshot_date = processing_date
    ) THEN
      -- Call the edge function to create snapshot
      SELECT INTO response_data net.http_post(
        url := 'https://mfcdlifjxxdrekzdatfb.supabase.co/functions/v1/daily-stock-snapshot',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk"}'::JSONB,
        body := format('{"targetDate": "%s"}', processing_date)::JSONB
      );
      
      -- Return result
      snapshot_date := processing_date;
      items_count := COALESCE((response_data->>'count')::INTEGER, 0);
      status := COALESCE(response_data->>'message', 'Created');
      RETURN NEXT;
    ELSE
      -- Snapshot already exists
      snapshot_date := processing_date;
      SELECT COUNT(*) INTO items_count 
      FROM daily_stock_snapshots 
      WHERE daily_stock_snapshots.snapshot_date = processing_date;
      status := 'Already exists';
      RETURN NEXT;
    END IF;
    
    processing_date := processing_date + INTERVAL '1 day';
  END LOOP;
END;
$$;

-- Schedule daily snapshot creation at 23:50 every day
SELECT cron.schedule(
  'daily-stock-snapshot',
  '50 23 * * *', -- At 23:50 every day
  $$
  SELECT net.http_post(
    url := 'https://mfcdlifjxxdrekzdatfb.supabase.co/functions/v1/daily-stock-snapshot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk"}'::JSONB,
    body := '{}'::JSONB
  ) AS request_id;
  $$
);