CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.expire_unanswered_calls()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.call_sessions
  SET status = 'missed',
      ended_reason = 'no_answer',
      ended_at = now(),
      updated_at = now()
  WHERE status IN ('calling', 'ringing')
    AND created_at < now() - interval '50 seconds';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_unanswered_calls() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_unanswered_calls() TO service_role;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'expire-unanswered-goodapp-calls';

SELECT cron.schedule(
  'expire-unanswered-goodapp-calls',
  '* * * * *',
  $$SELECT public.expire_unanswered_calls()$$
);