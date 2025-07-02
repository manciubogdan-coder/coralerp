-- Unschedule existing job
SELECT cron.unschedule('daily-stock-snapshot');

-- Schedule job at 2:00 UTC which is 5:00 Romania time (UTC+3 summer time)
-- Romania is UTC+2 in winter and UTC+3 in summer
SELECT cron.schedule(
  'daily-stock-snapshot',
  '0 2 * * *', -- At 2:00 UTC = 5:00 Romania time
  $$
  SELECT net.http_post(
    url := 'https://mfcdlifjxxdrekzdatfb.supabase.co/functions/v1/daily-stock-snapshot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk"}'::JSONB,
    body := '{}'::JSONB
  ) AS request_id;
  $$
);