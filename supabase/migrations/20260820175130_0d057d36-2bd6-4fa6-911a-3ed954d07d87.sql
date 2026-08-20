ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS whitelist_renew_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.transition_task_whitelist(_task_id uuid, _is_whitelisted boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  t public.tasks%ROWTYPE;
  now_at timestamptz := now();
  v_unlock numeric := 0;
  v_bonus numeric := 0;
  v_bonus_on boolean := true;
  v_pending_id uuid;
  v_pending_bonus numeric := 0;
  v_real_reverify boolean := false;
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

  -- A GENUINE re-verify only happens when the wallet had actually lost
  -- whitelist and the user went through GoodDollar again. Simply crossing
  -- reverify_due_at while the wallet is still whitelisted is a passive
  -- renewal: it must NOT count as a re-verify and must NOT pay the 10 BDT gift.
  v_real_reverify := coalesce(t.whitelist_ok, true) = false;

  IF v_real_reverify
     OR (t.status = 'verified'::public.task_status
         AND t.reverify_due_at IS NOT NULL
         AND t.reverify_due_at <= now_at) THEN
    v_unlock := greatest(coalesce(t.locked_mined, 0), 0);

    UPDATE public.tasks
    SET whitelist_ok = true,
        last_whitelist_check_at = now_at,
        status = 'done'::public.task_status,
        done_at = now_at,
        last_reverified_at = CASE WHEN v_real_reverify THEN now_at ELSE last_reverified_at END,
        reverify_count = coalesce(reverify_count, 0) + CASE WHEN v_real_reverify THEN 1 ELSE 0 END,
        whitelist_renew_count = coalesce(whitelist_renew_count, 0) + CASE WHEN v_real_reverify THEN 0 ELSE 1 END,
        locked_mined = 0
    WHERE id = _task_id;

    -- 10 BDT repeat-re-verify gift: only for a GENUINE re-verify on a slot
    -- that was already re-verified at least once before.
    IF v_real_reverify THEN
      SELECT coalesce(bonus_enabled, true) INTO v_bonus_on FROM public.bonus_settings WHERE id = 'default';
      IF coalesce(v_bonus_on, true) AND coalesce(t.reverify_count, 0) > 0 THEN
        v_bonus := 10;
      END IF;
    END IF;

    SELECT id, coalesce(bonus_amount, 0) INTO v_pending_id, v_pending_bonus
      FROM public.slot_claims
     WHERE task_id = _task_id AND status = 'pending'
     ORDER BY created_at
     LIMIT 1
     FOR UPDATE;

    IF v_pending_id IS NOT NULL THEN
      UPDATE public.slot_claims
         SET mining_amount = greatest(coalesce(mining_amount, 0), v_unlock),
             bonus_amount = greatest(v_pending_bonus, v_bonus)
       WHERE id = v_pending_id;
    ELSIF v_unlock > 0 OR v_bonus > 0 THEN
      INSERT INTO public.slot_claims (user_id, task_id, slot, bonus_amount, mining_amount)
      VALUES (t.user_id, t.id, t.slot, v_bonus, v_unlock);
    END IF;

    RETURN CASE WHEN v_real_reverify THEN 'restored' ELSE 'renewed' END;
  END IF;

  UPDATE public.tasks SET last_whitelist_check_at = now_at WHERE id = _task_id;
  RETURN 'unchanged';
END;
$function$;