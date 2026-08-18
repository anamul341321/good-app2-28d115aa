CREATE OR REPLACE FUNCTION public.claim_slot_mining(_user_id uuid, _task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_slot int;
  v_locked numeric := 0;
  v_mining numeric := 0;
  v_pending int := 0;
  v_overdue boolean := false;
BEGIN
  PERFORM public.settle_mining(_user_id);

  SELECT slot,
         greatest(coalesce(locked_mined, 0), 0),
         (coalesce(whitelist_ok, false) = false
          AND reverify_due_at IS NOT NULL
          AND reverify_due_at <= now())
    INTO v_slot, v_locked, v_overdue
    FROM public.tasks
   WHERE id = _task_id AND user_id = _user_id
   FOR UPDATE;

  IF v_slot IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- GoodDollar এই ঘরে Re-verify চেয়েছে কিন্তু করা হয়নি → মাইনিং লক
  IF v_overdue THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reverify_required');
  END IF;

  SELECT count(*) INTO v_pending
    FROM public.slot_claims
   WHERE user_id = _user_id AND task_id = _task_id AND status = 'pending';

  IF v_pending > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'use_full_claim');
  END IF;

  v_mining := floor(v_locked * 100) / 100;
  IF v_mining < 0.5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_small', 'pending', v_mining);
  END IF;

  UPDATE public.tasks
     SET locked_mined = greatest(coalesce(locked_mined, 0) - v_mining, 0)
   WHERE id = _task_id AND user_id = _user_id;

  INSERT INTO public.slot_claims (user_id, task_id, slot, bonus_amount, mining_amount, status, claimed_at)
  VALUES (_user_id, _task_id, v_slot, 0, v_mining, 'claimed', now());

  PERFORM set_config('app.balance_change_source', 'slot_mining_claim', true);

  UPDATE public.mining_state
     SET bonus_amount = coalesce(bonus_amount, 0) + v_mining
   WHERE user_id = _user_id;

  INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
  SELECT _user_id, v_mining, v_mining, 0,
         coalesce(accrued_amount, 0) - coalesce(withdrawn_amount, 0),
         'mining', 'ঘরের মাইনিং → মেইন ব্যালেন্স ক্লেইম'
    FROM public.mining_state WHERE user_id = _user_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, 0, 'slot_mining_claim', _task_id,
          jsonb_build_object('mining_moved_to_main', v_mining, 'bonus', 0, 'slot', v_slot));

  RETURN jsonb_build_object('ok', true, 'mining', v_mining, 'total', v_mining, 'slot', v_slot);
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_all_slot_mining(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_amt numeric := 0;
  v_total numeric := 0;
  v_slots int := 0;
  v_locked_slots int := 0;
BEGIN
  PERFORM public.settle_mining(_user_id);

  SELECT count(*) INTO v_locked_slots
    FROM public.tasks t
   WHERE t.user_id = _user_id
     AND coalesce(t.locked_mined, 0) > 0
     AND coalesce(t.whitelist_ok, false) = false
     AND t.reverify_due_at IS NOT NULL
     AND t.reverify_due_at <= now();

  FOR r IN
    SELECT t.id, t.slot, greatest(coalesce(t.locked_mined, 0), 0) AS locked
      FROM public.tasks t
     WHERE t.user_id = _user_id
       AND coalesce(t.locked_mined, 0) > 0
       -- Re-verify চাওয়া হয়েছে কিন্তু করা হয়নি → ওই ঘরের মাইনিং লক থাকবে
       AND NOT (coalesce(t.whitelist_ok, false) = false
                AND t.reverify_due_at IS NOT NULL
                AND t.reverify_due_at <= now())
       AND NOT EXISTS (
         SELECT 1 FROM public.slot_claims sc
          WHERE sc.user_id = _user_id AND sc.task_id = t.id AND sc.status = 'pending'
       )
     ORDER BY t.slot
     FOR UPDATE OF t
  LOOP
    v_amt := floor(r.locked * 100) / 100;
    IF v_amt <= 0 THEN CONTINUE; END IF;

    UPDATE public.tasks
       SET locked_mined = greatest(coalesce(locked_mined, 0) - v_amt, 0)
     WHERE id = r.id AND user_id = _user_id;

    INSERT INTO public.slot_claims (user_id, task_id, slot, bonus_amount, mining_amount, status, claimed_at)
    VALUES (_user_id, r.id, r.slot, 0, v_amt, 'claimed', now());

    INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
    VALUES (_user_id, 0, 'slot_mining_claim', r.id,
            jsonb_build_object('mining_moved_to_main', v_amt, 'bonus', 0, 'slot', r.slot, 'bulk', true));

    v_total := v_total + v_amt;
    v_slots := v_slots + 1;
  END LOOP;

  IF v_total < 0.5 THEN
    RETURN jsonb_build_object('ok', false, 'reason',
      CASE WHEN v_locked_slots > 0 THEN 'reverify_required' ELSE 'too_small' END,
      'pending', v_total, 'locked_slots', v_locked_slots);
  END IF;

  PERFORM set_config('app.balance_change_source', 'slot_mining_claim_all', true);

  UPDATE public.mining_state
     SET bonus_amount = coalesce(bonus_amount, 0) + v_total
   WHERE user_id = _user_id;

  INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
  SELECT _user_id, v_total, v_total, 0,
         coalesce(accrued_amount, 0) - coalesce(withdrawn_amount, 0),
         'mining', 'সব ঘরের মাইনিং → মেইন ব্যালেন্স ক্লেইম'
    FROM public.mining_state WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'mining', v_total, 'slots', v_slots, 'locked_slots', v_locked_slots);
END;
$function$;