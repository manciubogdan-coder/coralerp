-- Șterge cron job-ul vechi
SELECT cron.unschedule('daily-stock-snapshot');

-- Creez cron job nou care salvează exact stocul curent la 5:00 AM România (2:00 UTC)
SELECT cron.schedule(
  'daily-stock-snapshot',
  '0 2 * * *', -- la 2:00 AM UTC = 5:00 AM România
  $$
  SELECT net.http_post(
    url := 'https://mfcdlifjxxdrekzdatfb.supabase.co/functions/v1/daily-stock-snapshot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk"}'::JSONB,
    body := '{}'::JSONB
  ) AS request_id;
  $$
);