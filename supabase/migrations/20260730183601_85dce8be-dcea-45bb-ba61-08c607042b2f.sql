ALTER TABLE public.whitelist_runs
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'wallets',
  ADD COLUMN IF NOT EXISTS wallet_cursor uuid,
  ADD COLUMN IF NOT EXISTS pending_cursor uuid,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS whitelist_runs_running_idx
  ON public.whitelist_runs (status, started_at DESC);

UPDATE public.whitelist_runs
SET status = 'timeout',
    finished_at = now(),
    error_message = 'Replaced by resumable batch worker'
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
      'whitelist-recheck-every-5min'
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
    url:='https://project--9faa7771-af86-4101-8cf2-0ed6dd381713.lovable.app/api/public/whitelist-recheck',
    headers:=jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_4DyP1XkSPdRbBr04bFefRw_nqpGiHOR'),
    body:='{}'::jsonb,
    timeout_milliseconds:=50000
  ) as request_id;
  $cron$
);