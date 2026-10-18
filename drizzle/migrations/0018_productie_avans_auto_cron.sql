SELECT cron.schedule(
  'productie-avans-auto',
  '50 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yeniohmlmxhjzywqlidx.supabase.co/functions/v1/productie-avans-auto',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbmlvaG1sbXhoanp5d3FsaWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjM0ODgsImV4cCI6MjA5MzEzOTQ4OH0.8rNaYX5D5hk22o_bUqERO9ChJfQdJYkaKiD9UsRi1mE"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);