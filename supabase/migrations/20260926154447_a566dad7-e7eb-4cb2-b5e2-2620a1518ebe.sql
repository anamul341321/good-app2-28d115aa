SELECT cron.schedule(
  'daily-claim-warning',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://goodapp2.live/api/public/daily-claim-warning',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', public.get_whitelist_cron_secret()
    ),
    body := '{}'::jsonb
  );
  $$
);