ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reverify_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reverified_at timestamptz;

UPDATE public.tasks
SET reverify_count = GREATEST(reverify_count, 1),
    last_reverified_at = COALESCE(last_reverified_at, done_at)
WHERE status = 'done' AND done_at IS NOT NULL;

COMMENT ON COLUMN public.tasks.reverify_count IS 'Number of successful GoodDollar re-verification cycles completed for this task';
COMMENT ON COLUMN public.tasks.last_reverified_at IS 'Timestamp of the most recent successful GoodDollar re-verification';