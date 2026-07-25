UPDATE public.tasks
SET reverify_count = 1,
    last_reverified_at = initial_verify_at + interval '5 days'
WHERE wallet_address IS NOT NULL
  AND whitelist_ok = true
  AND status IN ('verified'::public.task_status, 'done'::public.task_status)
  AND initial_verify_at IS NOT NULL
  AND initial_verify_at::date <= current_date - 5
  AND coalesce(reverify_count, 0) = 0;