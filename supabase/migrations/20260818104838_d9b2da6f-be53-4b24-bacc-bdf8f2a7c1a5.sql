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
BEGIN
  PERFORM public.settle_mining(_user_id);

  FOR r IN
    SELECT t.id, t.slot, greatest(coalesce(t.locked_mined, 0), 0) AS locked
      FROM public.tasks t
     WHERE t.user_id = _user_id
       AND coalesce(t.locked_mined, 0) > 0
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
    RETURN jsonb_build_object('ok', false, 'reason', 'too_small', 'pending', v_total);
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

  RETURN jsonb_build_object('ok', true, 'mining', v_total, 'slots', v_slots);
END;
$function$;