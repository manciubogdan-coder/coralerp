-- Actualizare cron job pentru ambalaje la ora 07:05 România (04:05 UTC)

-- Șterge vechiul cron job pentru ambalaje
SELECT cron.unschedule('daily-ambalaje-stock-snapshot');

-- Creează noul cron job la ora 04:05 UTC (07:05 România) - 5 minute după materiile prime
SELECT cron.schedule(
  'daily-ambalaje-stock-snapshot',
  '5 4 * * *', -- La ora 04:05 UTC în fiecare zi (07:05 România)
  $$
  SELECT net.http_post(
    url := 'https://mfcdlifjxxdrekzdatfb.supabase.co/functions/v1/daily-stock-snapshot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk"}'::jsonb,
    body := '{"inventoryType": "ambalaje"}'::jsonb
  );
  $$
);