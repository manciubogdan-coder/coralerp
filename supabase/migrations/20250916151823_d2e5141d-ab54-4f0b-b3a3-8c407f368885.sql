-- Modificare ora generare stoc zilnic de la 23:50 UTC la 04:00 UTC (7:00 România)

-- Șterge vechiul cron job
SELECT cron.unschedule('daily-stock-snapshot');

-- Creează noul cron job la ora 04:00 UTC (07:00 România)
SELECT cron.schedule(
  'daily-stock-snapshot',
  '0 4 * * *', -- La ora 04:00 UTC în fiecare zi (07:00 România)
  $$
  SELECT net.http_post(
    url := 'https://mfcdlifjxxdrekzdatfb.supabase.co/functions/v1/daily-stock-snapshot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk"}'::JSONB,
    body := '{}'::JSONB
  ) AS request_id;
  $$
);