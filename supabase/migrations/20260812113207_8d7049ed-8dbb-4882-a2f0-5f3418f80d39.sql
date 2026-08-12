DO $$
DECLARE existing_job record;
BEGIN
  FOR existing_job IN SELECT jobid FROM cron.job WHERE jobname = 'celo-sweep-worker-every-minute' LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'celo-sweep-worker-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--9faa7771-af86-4101-8cf2-0ed6dd381713.lovable.app/api/public/celo-sweep/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_4DyP1XkSPdRbBr04bFefRw_nqpGiHOR',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whitelist_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 50000
  ) AS request_id;
  $cron$
);