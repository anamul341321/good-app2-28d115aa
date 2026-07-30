ALTER TABLE public.whitelist_runs
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS whitelist_runs_one_running_idx
  ON public.whitelist_runs ((status))
  WHERE status = 'running';

UPDATE public.whitelist_runs
SET wallets_checked = LEAST(wallets_checked, wallets_total),
    pending_total = GREATEST(pending_total, pending_checked),
    batches_done = CEIL((LEAST(wallets_checked, wallets_total) + pending_checked)::numeric / 100)::integer
WHERE id = (
  SELECT id FROM public.whitelist_runs ORDER BY started_at DESC LIMIT 1
);

CREATE OR REPLACE FUNCTION public.claim_whitelist_run(_run_id uuid, _lease_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.whitelist_runs
  SET lease_token = _lease_token,
      lease_until = now() + interval '55 seconds',
      heartbeat_at = now()
  WHERE id = _run_id
    AND status = 'running'
    AND (lease_until IS NULL OR lease_until < now() OR lease_token = _lease_token);
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_whitelist_run(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whitelist_run(uuid, uuid) TO service_role;