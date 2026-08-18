CREATE OR REPLACE FUNCTION public.transition_task_whitelist(_task_id uuid, _is_whitelisted boolean)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  t public.tasks%ROWTYPE;
  now_at timestamptz := now();
  v_unlock numeric := 0;
  v_bonus numeric := 0;
  v_bonus_on boolean := true;
BEGIN
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'missing'; END IF;

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

    UPDATE public.tasks SET last_whitelist_check_at = now_at WHERE id = _task_id;
    RETURN 'unchanged';
  END IF;

  -- Treat as a completed re-verify when the slot lost whitelist OR the slot is
  -- sitting in `verified` with its re-verify already due (user re-submitted).
  IF coalesce(t.whitelist_ok, true) = false
     OR (t.status = 'verified'::public.task_status
         AND t.reverify_due_at IS NOT NULL
         AND t.reverify_due_at <= now_at) THEN
    v_unlock := greatest(coalesce(t.locked_mined, 0), 0);

    UPDATE public.tasks
    SET whitelist_ok = true,
        last_whitelist_check_at = now_at,
        status = 'done'::public.task_status,
        done_at = now_at,
        last_reverified_at = now_at,
        reverify_count = coalesce(reverify_count, 0) + 1,
        locked_mined = 0
    WHERE id = _task_id;

    -- 10 BDT repeat-re-verify gift: ONLY for slots that were already
    -- re-verified at least once before. A first-ever re-verify (right after
    -- first verify) gets no 10 BDT — those users keep the normal bonus rate.
    SELECT coalesce(bonus_enabled, true) INTO v_bonus_on FROM public.bonus_settings WHERE id = 'default';
    IF coalesce(v_bonus_on, true) AND coalesce(t.reverify_count, 0) > 0 THEN
      v_bonus := 10;
    END IF;

    IF v_unlock > 0 OR v_bonus > 0 THEN
      INSERT INTO public.slot_claims (user_id, task_id, slot, bonus_amount, mining_amount)
      VALUES (t.user_id, t.id, t.slot, v_bonus, v_unlock);
    END IF;

    RETURN 'restored';
  END IF;

  UPDATE public.tasks SET last_whitelist_check_at = now_at WHERE id = _task_id;
  RETURN 'unchanged';
END; $function$;