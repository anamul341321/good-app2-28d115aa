
CREATE OR REPLACE FUNCTION public.transition_task_whitelist(_task_id uuid, _is_whitelisted boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.tasks%ROWTYPE;
  now_at timestamptz := now();
BEGIN
  SELECT * INTO t
  FROM public.tasks
  WHERE id = _task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;

  -- If the slot has been reset/emptied (no wallet) between the cron's SELECT
  -- and this RPC call, do NOT re-mark it as verified/not-whitelisted.
  IF t.wallet_address IS NULL OR t.status = 'empty'::public.task_status THEN
    RETURN 'skipped_empty';
  END IF;

  IF NOT _is_whitelisted THEN
    IF t.status <> 'verified'::public.task_status OR coalesce(t.whitelist_ok, true) <> false THEN
      UPDATE public.tasks
      SET whitelist_ok = false,
          last_whitelist_check_at = now_at,
          status = 'verified'::public.task_status,
          reverify_due_at = now_at
      WHERE id = _task_id;
      RETURN 'lost';
    END IF;

    UPDATE public.tasks
    SET last_whitelist_check_at = now_at
    WHERE id = _task_id;
    RETURN 'unchanged';
  END IF;

  IF coalesce(t.whitelist_ok, true) = false THEN
    UPDATE public.tasks
    SET whitelist_ok = true,
        last_whitelist_check_at = now_at,
        status = 'done'::public.task_status,
        done_at = now_at,
        last_reverified_at = now_at,
        reverify_count = coalesce(reverify_count, 0) + 1
    WHERE id = _task_id;
    RETURN 'restored';
  END IF;

  UPDATE public.tasks
  SET last_whitelist_check_at = now_at
  WHERE id = _task_id;
  RETURN 'unchanged';
END;
$function$;

-- Repair any slot currently stuck in the empty-but-verified state
UPDATE public.tasks
SET status = 'empty'::public.task_status,
    whitelist_ok = true,
    reverify_due_at = NULL,
    done_at = NULL,
    initial_verify_at = NULL,
    last_whitelist_check_at = NULL,
    last_reverified_at = NULL,
    reverify_count = 0
WHERE wallet_address IS NULL
  AND face_photo_url IS NULL
  AND status <> 'empty'::public.task_status;
