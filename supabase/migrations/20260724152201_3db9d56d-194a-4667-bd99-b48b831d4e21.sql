CREATE OR REPLACE FUNCTION public.transition_task_whitelist(
  _task_id uuid,
  _is_whitelisted boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.transition_task_whitelist(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_task_whitelist(uuid, boolean) TO service_role;