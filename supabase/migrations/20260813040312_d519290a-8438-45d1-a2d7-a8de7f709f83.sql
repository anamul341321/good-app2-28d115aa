-- Schedule re-verify reminder worker. It runs every 6 hours and sends push
-- notifications to users whose tasks are 3 days, 1 day, 6 hours, or 0 hours away
-- from the re-verify due date. Only one reminder per window per task.
DO $$
DECLARE existing_job record;
BEGIN
  FOR existing_job IN SELECT jobid FROM cron.job WHERE jobname = 'reverify-reminders-every-6hour' LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'reverify-reminders-every-6hour',
  '0 */6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--9faa7771-af86-4101-8cf2-0ed6dd381713.lovable.app/api/public/reverify-reminders',
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
