CREATE OR REPLACE FUNCTION public.get_user_balance_breakdown(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m public.mining_state%ROWTYPE;
  v_bal numeric := 0;
  v_bonus numeric := 0;
  v_withdrawn numeric := 0;
  v_mining_withdrawn numeric := 0;
  v_main_withdrawn numeric := 0;
  v_main numeric := 0;
  v_mining numeric := 0;
  v_avail numeric := 0;
  v_slot_locked numeric := 0;
  v_slot_claimed numeric := 0;
  v_ref_claimed numeric := 0;
  v_ref_available numeric := 0;
BEGIN
  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN '{"total_accrued":0,"withdrawn_total":0,"bonus_part":0,"mining_part":0,"mining_available":0,"mining_locked":0,"available_now":0,"current_balance":0,"total_spent":0,"self_mining_total":0,"self_mining_locked":0,"self_mining_claimed":0,"referral_mining_total":0,"referral_mining_available":0,"referral_mining_claimed":0}'::jsonb;
  END IF;

  SELECT coalesce(sum(greatest(locked_mined, 0)), 0)
    INTO v_slot_locked
    FROM public.tasks
   WHERE user_id = _user_id;

  SELECT coalesce(sum(CASE WHEN kind = 'mining' THEN greatest(self_amount, 0) ELSE 0 END), 0),
         coalesce(sum(CASE WHEN kind = 'mining' THEN greatest(referral_amount, 0) ELSE 0 END), 0)
    INTO v_slot_claimed, v_ref_claimed
    FROM public.mining_claims
   WHERE user_id = _user_id;

  v_withdrawn := greatest(coalesce(m.withdrawn_amount, 0), 0);
  v_bonus := greatest(coalesce(m.bonus_amount, 0), 0);
  v_mining_withdrawn := least(greatest(coalesce(m.mining_withdrawn, 0), 0), v_withdrawn);
  v_bal := greatest(coalesce(m.accrued_amount, 0) - v_withdrawn, 0);
  v_main_withdrawn := greatest(v_withdrawn - v_mining_withdrawn, 0);
  v_main := greatest(least(v_bal, v_bonus - v_main_withdrawn), 0);
  v_mining := greatest(v_bal - v_main, 0);
  v_ref_available := greatest(coalesce(m.referral_accrued, 0) - v_ref_claimed, 0);
  v_avail := least(least(greatest(coalesce(m.mining_unlocked, 0), 0), v_ref_available), v_mining);

  RETURN jsonb_build_object(
    'total_accrued', coalesce(m.accrued_amount, 0),
    'withdrawn_total', v_withdrawn,
    'bonus_part', v_main,
    'mining_part', v_mining,
    'mining_available', v_avail,
    'mining_locked', greatest(v_mining - v_avail, 0),
    'available_now', v_main + v_avail,
    'current_balance', v_bal,
    'total_spent', v_withdrawn,
    'self_mining_total', greatest(coalesce(m.self_mining_accrued, 0), 0),
    'self_mining_locked', v_slot_locked,
    'self_mining_claimed', least(v_slot_claimed, greatest(coalesce(m.self_mining_accrued, 0), 0)),
    'referral_mining_total', greatest(coalesce(m.referral_accrued, 0), 0),
    'referral_mining_available', v_avail,
    'referral_mining_claimed', least(v_ref_claimed, greatest(coalesce(m.referral_accrued, 0), 0))
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_mining_to_main(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_break jsonb;
  v_amount numeric := 0;
BEGIN
  PERFORM public.settle_mining(_user_id);
  v_break := public.get_user_balance_breakdown(_user_id);
  v_amount := floor(coalesce((v_break->>'referral_mining_available')::numeric, 0) * 100) / 100;

  IF v_amount < 0.5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_small', 'pending', v_amount);
  END IF;

  PERFORM set_config('app.balance_change_source', 'referral_commission_claim', true);
  UPDATE public.mining_state
     SET bonus_amount = coalesce(bonus_amount, 0) + v_amount,
         mining_unlocked = greatest(coalesce(mining_unlocked, 0) - v_amount, 0)
   WHERE user_id = _user_id;

  INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
  SELECT _user_id, v_amount, 0, v_amount,
         coalesce(accrued_amount, 0) - coalesce(withdrawn_amount, 0),
         'mining', 'রেফারেল ১০% কমিশন → মেইন ব্যালেন্স ক্লেইম'
    FROM public.mining_state WHERE user_id = _user_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
  VALUES (_user_id, 0, 'mining_claim',
          jsonb_build_object('moved_to_main', v_amount, 'self', 0, 'referral_commission', v_amount, 'reason', 'referral_commission_claim'));

  RETURN jsonb_build_object('ok', true, 'amount', v_amount, 'self', 0, 'referral', v_amount);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_balance_breakdown(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_mining_to_main(uuid) TO authenticated, service_role;

DO $repair$
DECLARE
  v_user uuid;
  v_self numeric;
  v_per_slot numeric;
  v_old_claim numeric;
  v_new_claim numeric;
  v_delta numeric;
  v_claim_id uuid;
  v_claim_task uuid;
BEGIN
  SELECT id INTO v_user FROM public.profiles WHERE uid_seq = 1184;
  IF v_user IS NULL THEN RETURN; END IF;

  SELECT greatest(coalesce(self_mining_accrued, 0), 0)
    INTO v_self FROM public.mining_state WHERE user_id = v_user FOR UPDATE;
  v_per_slot := v_self / 10.0;

  SELECT mc.id, mc.amount, sc.task_id
    INTO v_claim_id, v_old_claim, v_claim_task
    FROM public.mining_claims mc
    JOIN public.slot_claims sc ON sc.user_id = mc.user_id
      AND sc.status = 'claimed'
      AND abs(sc.mining_amount - mc.amount) < 0.02
      AND abs(extract(epoch from (sc.claimed_at - mc.created_at))) < 5
   WHERE mc.user_id = v_user
     AND mc.note = 'ঘরের মাইনিং → মেইন ব্যালেন্স ক্লেইম'
   ORDER BY mc.created_at DESC
   LIMIT 1;

  IF v_claim_id IS NOT NULL THEN
    v_new_claim := least(v_per_slot, v_self);
    v_delta := v_old_claim - v_new_claim;

    UPDATE public.mining_claims
       SET amount = v_new_claim, self_amount = v_new_claim,
           note = 'ঘরের মাইনিং → মেইন ব্যালেন্স ক্লেইম (মূল স্লট হিসাব)'
     WHERE id = v_claim_id;

    UPDATE public.slot_claims
       SET mining_amount = v_new_claim
     WHERE user_id = v_user AND task_id = v_claim_task AND status = 'claimed';

    IF v_delta > 0 THEN
      UPDATE public.mining_state
         SET bonus_amount = greatest(coalesce(bonus_amount, 0) - v_delta, 0)
       WHERE user_id = v_user;
    END IF;
  ELSE
    v_new_claim := 0;
  END IF;

  UPDATE public.tasks
     SET locked_mined = CASE
       WHEN id = v_claim_task THEN greatest(locked_mined, 0)
       ELSE greatest((v_self - v_new_claim) / 9.0, 0)
     END
   WHERE user_id = v_user
     AND slot BETWEEN 1 AND 10
     AND coalesce(reverify_count, 0) > 0;

  UPDATE public.mining_claims
     SET self_amount = 0,
         referral_amount = amount,
         note = 'রেফারেল ১০% কমিশন → মেইন ব্যালেন্স ক্লেইম'
   WHERE user_id = v_user
     AND note = 'মাইনিং → মেইন ব্যালেন্স ক্লেইম'
     AND referral_amount = 0;
END;
$repair$;