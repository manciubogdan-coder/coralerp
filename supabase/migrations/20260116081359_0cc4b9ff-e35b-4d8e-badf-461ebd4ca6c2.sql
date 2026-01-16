-- Dezactivez job-urile vechi și creez altele noi cu ora corectă
SELECT cron.unschedule('daily-stock-snapshot');
SELECT cron.unschedule('daily-ambalaje-stock-snapshot');

-- Stoc principal la 03:00 UTC = 05:00 ora României
SELECT cron.schedule(
  'daily-stock-snapshot',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mfcdlifjxxdrekzdatfb.supabase.co/functions/v1/daily-stock-snapshot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk"}'::JSONB,
    body := '{}'::JSONB
  ) AS request_id;
  $$
);

-- Stoc ambalaje la 03:05 UTC = 05:05 ora României
SELECT cron.schedule(
  'daily-ambalaje-stock-snapshot',
  '5 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mfcdlifjxxdrekzdatfb.supabase.co/functions/v1/daily-stock-snapshot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk"}'::jsonb,
    body := '{"inventoryType": "ambalaje"}'::jsonb
  );
  $$
);