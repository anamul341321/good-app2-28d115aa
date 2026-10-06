CREATE OR REPLACE FUNCTION public.transition_task_whitelist(_task_id uuid, _is_whitelisted boolean)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  t public.tasks%ROWTYPE;
  now_at timestamptz := now();
  v_unlock numeric := 0;
  v_bonus numeric := 0;
  v_pending_id uuid;
  v_real_reverify boolean := false;
BEGIN
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF t.wallet_address IS NULL OR t.status = 'empty'::public.task_status THEN RETURN 'skipped_empty'; END IF;

  IF NOT _is_whitelisted THEN
    IF t.status <> 'verified'::public.task_status OR coalesce(t.whitelist_ok, true) <> false THEN
      PERFORM public.settle_mining(t.user_id);
      UPDATE public.tasks SET whitelist_ok = false, last_whitelist_check_at = now_at,
          status = 'verified'::public.task_status, reverify_due_at = now_at
      WHERE id = _task_id;
      RETURN 'lost';
    END IF;
    UPDATE public.tasks SET last_whitelist_check_at = now_at WHERE id = _task_id;
    RETURN 'unchanged';
  END IF;

  v_real_reverify := coalesce(t.whitelist_ok, true) = false;

  IF v_real_reverify OR (t.status = 'verified'::public.task_status AND t.reverify_due_at IS NOT NULL AND t.reverify_due_at <= now_at) THEN
    PERFORM public.settle_mining(t.user_id);
    SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
    v_unlock := greatest(coalesce(t.locked_mined, 0), 0);

    UPDATE public.tasks
    SET whitelist_ok = true, last_whitelist_check_at = now_at, status = 'done'::public.task_status, done_at = now_at,
        last_reverified_at = CASE WHEN v_real_reverify THEN now_at ELSE last_reverified_at END,
        reverify_count = coalesce(reverify_count, 0) + CASE WHEN v_real_reverify THEN 1 ELSE 0 END,
        whitelist_renew_count = coalesce(whitelist_renew_count, 0) + CASE WHEN v_real_reverify THEN 0 ELSE 1 END,
        locked_mined = 0
    WHERE id = _task_id;

    -- 10 BDT repeat-re-verify gift goes straight to MAIN balance (it is a bonus).
    IF v_real_reverify AND coalesce(t.reverify_count, 0) > 0 THEN
      v_bonus := 10;
      PERFORM public.credit_bonus_balance(t.user_id, v_bonus, 'bonus', t.id,
        jsonb_build_object('reason','repeat_reverify_gift','slot',t.slot));
      INSERT INTO public.user_notices (user_id, title, body, metadata)
      VALUES (t.user_id, '🎁 ১০৳ বোনাস মেইন ব্যালেন্সে যোগ হয়েছে',
        '#' || t.slot || ' নং ঘর আবার রি-ভেরিফাই করায় ১০৳ বোনাস সরাসরি মেইন ব্যালেন্সে যোগ হয়েছে।',
        jsonb_build_object('severity','success','url','/home'));
    END IF;

    IF v_unlock > 0 THEN
      SELECT id INTO v_pending_id FROM public.slot_claims
       WHERE task_id = _task_id AND status = 'pending' ORDER BY created_at LIMIT 1 FOR UPDATE;
      IF v_pending_id IS NOT NULL THEN
        UPDATE public.slot_claims SET mining_amount = greatest(coalesce(mining_amount, 0), v_unlock) WHERE id = v_pending_id;
      ELSE
        INSERT INTO public.slot_claims (user_id, task_id, slot, bonus_amount, mining_amount)
        VALUES (t.user_id, t.id, t.slot, 0, v_unlock);
      END IF;
    END IF;

    RETURN CASE WHEN v_real_reverify THEN 'restored' ELSE 'renewed' END;
  END IF;

  UPDATE public.tasks SET last_whitelist_check_at = now_at WHERE id = _task_id;
  RETURN 'unchanged';
END;
$function$;

-- Move already-waiting 10৳ gifts into main balance now.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, user_id, task_id, slot, bonus_amount FROM public.slot_claims
            WHERE status = 'pending' AND coalesce(bonus_amount,0) > 0 FOR UPDATE
  LOOP
    PERFORM public.credit_bonus_balance(r.user_id, r.bonus_amount, 'bonus', r.task_id,
      jsonb_build_object('reason','repeat_reverify_gift_backfill','slot',r.slot));
    UPDATE public.slot_claims SET bonus_amount = 0 WHERE id = r.id;
    DELETE FROM public.slot_claims WHERE id = r.id AND coalesce(mining_amount,0) = 0;
  END LOOP;
END $$;