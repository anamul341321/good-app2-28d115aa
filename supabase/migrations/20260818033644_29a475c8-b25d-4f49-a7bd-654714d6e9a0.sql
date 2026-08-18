CREATE OR REPLACE FUNCTION public.claim_slot_reward(_user_id uuid, _task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bonus numeric := 0;
  v_mining numeric := 0;
  v_total numeric := 0;
BEGIN
  PERFORM public.settle_mining(_user_id);

  SELECT coalesce(sum(bonus_amount), 0), coalesce(sum(mining_amount), 0)
    INTO v_bonus, v_mining
    FROM public.slot_claims
   WHERE user_id = _user_id AND task_id = _task_id AND status = 'pending'
     FOR UPDATE;

  v_bonus := floor(greatest(v_bonus, 0) * 100) / 100;
  v_mining := floor(greatest(v_mining, 0) * 100) / 100;
  v_total := v_bonus + v_mining;

  IF v_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_to_claim');
  END IF;

  UPDATE public.slot_claims
     SET status = 'claimed', claimed_at = now()
   WHERE user_id = _user_id AND task_id = _task_id AND status = 'pending';

  PERFORM set_config('app.balance_change_source', 'slot_claim', true);

  -- বোনাস = নতুন টাকা (accrued বাড়বে); মাইনিং = আগেই accrued-এ আছে, শুধু মেইন ভাগে সরানো হবে
  UPDATE public.mining_state
     SET accrued_amount = coalesce(accrued_amount, 0) + v_bonus,
         bonus_amount   = coalesce(bonus_amount, 0) + v_total
   WHERE user_id = _user_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, v_bonus, 'slot_claim', _task_id,
          jsonb_build_object('bonus', v_bonus, 'mining_moved_to_main', v_mining, 'total', v_total));

  IF v_mining > 0 THEN
    INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
    SELECT _user_id, v_mining, v_mining, 0,
           coalesce(accrued_amount, 0) - coalesce(withdrawn_amount, 0),
           'mining', 'ঘরের মাইনিং → মেইন ব্যালেন্স ক্লেইম'
      FROM public.mining_state WHERE user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'bonus', v_bonus, 'mining', v_mining, 'total', v_total);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_slot_reward(uuid, uuid) TO service_role;