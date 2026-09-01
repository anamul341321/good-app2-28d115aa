CREATE OR REPLACE FUNCTION public.get_user_balance_breakdown(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.mining_state%ROWTYPE;
  v_bal numeric := 0;
  v_bonus numeric := 0;
  v_withdrawn numeric := 0;
  v_main numeric := 0;
  v_mining numeric := 0;
  v_avail numeric := 0;
  v_slot_locked numeric := 0;
  v_slot_claimable numeric := 0;
  v_slot_pending numeric := 0;
  v_slot_claimed numeric := 0;
  v_ref_claimed numeric := 0;
  v_ref_available numeric := 0;
BEGIN
  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN '{"total_accrued":0,"withdrawn_total":0,"bonus_part":0,"mining_part":0,"mining_available":0,"mining_locked":0,"available_now":0,"current_balance":0,"total_spent":0,"self_mining_total":0,"self_mining_locked":0,"self_mining_claimable":0,"self_mining_pending":0,"self_mining_claimed":0,"referral_mining_total":0,"referral_mining_available":0,"referral_mining_claimed":0}'::jsonb;
  END IF;

  SELECT coalesce(sum(greatest(locked_mined, 0)), 0),
         coalesce(sum(CASE WHEN coalesce(whitelist_ok, false) THEN greatest(locked_mined, 0) ELSE 0 END), 0)
    INTO v_slot_locked, v_slot_claimable
    FROM public.tasks
   WHERE user_id = _user_id;

  SELECT coalesce(sum(CASE WHEN status = 'pending' THEN greatest(mining_amount, 0) ELSE 0 END), 0),
         coalesce(sum(CASE WHEN status = 'claimed' THEN greatest(mining_amount, 0) ELSE 0 END), 0)
    INTO v_slot_pending, v_slot_claimed
    FROM public.slot_claims
   WHERE user_id = _user_id;

  SELECT coalesce(sum(CASE WHEN kind = 'mining' AND note = 'রেফারেল ১০% কমিশন → মেইন ব্যালেন্স ক্লেইম' THEN greatest(referral_amount, 0) ELSE 0 END), 0)
    INTO v_ref_claimed
    FROM public.mining_claims
   WHERE user_id = _user_id;

  v_withdrawn := greatest(coalesce(m.withdrawn_amount, 0), 0);
  v_bonus := greatest(coalesce(m.bonus_amount, 0), 0);
  v_bal := greatest(coalesce(m.accrued_amount, 0) - v_withdrawn, 0);
  v_ref_available := greatest(coalesce(m.referral_accrued, 0) - v_ref_claimed, 0);

  -- মাইনিং পকেট = এখনো ক্লেইম না করা নিজের স্লট মাইনিং + এখনো ক্লেইম না করা রেফার কমিশন।
  -- ক্লেইম করলেই সেটি মাইনিং পকেট থেকে বাদ যায়, তাই বাকিটা সরাসরি মেইন ব্যালেন্স।
  v_mining := least(greatest(v_slot_locked + v_ref_available, 0), v_bal);
  v_main := greatest(v_bal - v_mining, 0);
  v_avail := least(v_ref_available, v_mining);

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
    'bonus_credited', v_bonus,
    'self_mining_total', greatest(coalesce(m.self_mining_accrued, 0), 0),
    'self_mining_locked', v_slot_locked,
    'self_mining_claimable', v_slot_claimable,
    'self_mining_pending', v_slot_pending,
    'self_mining_claimed', v_slot_claimed,
    'referral_mining_total', greatest(coalesce(m.referral_accrued, 0), 0),
    'referral_mining_available', v_avail,
    'referral_mining_claimed', least(v_ref_claimed, greatest(coalesce(m.referral_accrued, 0), 0))
  );
END;
$$;