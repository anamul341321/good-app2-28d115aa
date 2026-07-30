CREATE TABLE public.whitelist_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  batch_size integer NOT NULL DEFAULT 100,
  batches_done integer NOT NULL DEFAULT 0,
  wallets_total integer NOT NULL DEFAULT 0,
  wallets_checked integer NOT NULL DEFAULT 0,
  pending_total integer NOT NULL DEFAULT 0,
  pending_checked integer NOT NULL DEFAULT 0,
  pending_promoted integer NOT NULL DEFAULT 0,
  flipped integer NOT NULL DEFAULT 0,
  restored integer NOT NULL DEFAULT 0,
  error_message text
);

GRANT ALL ON public.whitelist_runs TO service_role;
ALTER TABLE public.whitelist_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX whitelist_runs_started_at_idx ON public.whitelist_runs (started_at DESC);

SELECT cron.unschedule('whitelist-recheck-every-minute');
SELECT cron.schedule(
  'whitelist-recheck-every-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--9faa7771-af86-4101-8cf2-0ed6dd381713.lovable.app/api/public/whitelist-recheck',
    headers:=jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_4DyP1XkSPdRbBr04bFefRw_nqpGiHOR'),
    body:='{}'::jsonb,
    timeout_milliseconds:=110000
  ) as request_id;
  $$
);