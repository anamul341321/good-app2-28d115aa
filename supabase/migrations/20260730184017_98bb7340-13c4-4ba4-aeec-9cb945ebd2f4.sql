UPDATE public.whitelist_runs
SET status = 'timeout',
    finished_at = now(),
    error_message = 'Stopped old published worker during scheduler upgrade',
    lease_token = NULL,
    lease_until = NULL
WHERE status = 'running';

DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'whitelist-recheck-every-minute',
      'whitelist-recheck-every-2min',
      'whitelist-recheck-every-5min',
      'whitelist-recheck-worker-every-minute'
    )
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'whitelist-recheck-worker-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url:='https://project--9faa7771-af86-4101-8cf2-0ed6dd381713-dev.lovable.app/api/public/whitelist-recheck',
    headers:=jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_4DyP1XkSPdRbBr04bFefRw_nqpGiHOR'),
    body:='{}'::jsonb,
    timeout_milliseconds:=50000
  ) as request_id;
  $cron$
);