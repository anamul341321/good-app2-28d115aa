ALTER TABLE public.mining_state
  ADD COLUMN IF NOT EXISTS pending_mining numeric NOT NULL DEFAULT 0;

-- 1) Breakdown: split claimed-but-not-yet-withdrawable mining into its own pocket
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
  v_main numeric := 0;
  v_mining numeric := 0;
  v_avail numeric := 0;
  v_slot_locked numeric := 0;
  v_slot_claimable numeric := 0;
  v_slot_pending numeric := 0;
  v_slot_claimed numeric := 0;
  v_ref_claimed numeric := 0;
  v_ref_available numeric := 0;
  v_pending numeric := 0;
BEGIN
  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN '{"total_accrued":0,"withdrawn_total":0,"bonus_part":0,"mining_part":0,"pending_part":0,"mining_available":0,"mining_locked":0,"available_now":0,"current_balance":0,"total_spent":0,"self_mining_total":0,"self_mining_locked":0,"self_mining_claimable":0,"self_mining_pending":0,"self_mining_claimed":0,"referral_mining_total":0,"referral_mining_available":0,"referral_mining_claimed":0}'::jsonb;
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

  v_mining := least(greatest(v_slot_locked + v_ref_available, 0), v_bal);
  v_main := greatest(v_bal - v_mining, 0);
  -- ক্লেইম করা মাইনিং = পেন্ডিং পকেট (শুধু ১–৩ তারিখে উইথড্র)
  v_pending := least(greatest(coalesce(m.pending_mining, 0), 0), v_main);
  v_main := greatest(v_main - v_pending, 0);
  v_avail := least(v_ref_available, v_mining);

  RETURN jsonb_build_object(
    'total_accrued', coalesce(m.accrued_amount, 0),
    'withdrawn_total', v_withdrawn,
    'bonus_part', v_main,
    'pending_part', v_pending,
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
$function$;

-- 2) Single slot mining claim → pending pocket
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
  v_ok boolean := false;
BEGIN
  PERFORM public.settle_mining(_user_id);

  SELECT slot,
         greatest(coalesce(locked_mined, 0), 0),
         coalesce(whitelist_ok, false)
    INTO v_slot, v_locked, v_ok
    FROM public.tasks
   WHERE id = _task_id AND user_id = _user_id
   FOR UPDATE;

  IF v_slot IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT v_ok THEN
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
     SET bonus_amount = coalesce(bonus_amount, 0) + v_mining,
         pending_mining = coalesce(pending_mining, 0) + v_mining
   WHERE user_id = _user_id;

  INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
  SELECT _user_id, v_mining, v_mining, 0,
         coalesce(accrued_amount, 0) - coalesce(withdrawn_amount, 0),
         'mining', 'ঘরের মাইনিং → পেন্ডিং ব্যালেন্স ক্লেইম'
    FROM public.mining_state WHERE user_id = _user_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, 0, 'slot_mining_claim', _task_id,
          jsonb_build_object('mining_moved_to_pending', v_mining, 'bonus', 0, 'slot', v_slot));

  RETURN jsonb_build_object('ok', true, 'mining', v_mining, 'total', v_mining, 'slot', v_slot);
END;
$function$;

-- 3) All-slot mining claim → pending pocket
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
     AND coalesce(t.whitelist_ok, false) = false;

  FOR r IN
    SELECT t.id, t.slot, greatest(coalesce(t.locked_mined, 0), 0) AS locked
      FROM public.tasks t
     WHERE t.user_id = _user_id
       AND coalesce(t.locked_mined, 0) > 0
       AND coalesce(t.whitelist_ok, false) = true
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
            jsonb_build_object('mining_moved_to_pending', v_amt, 'bonus', 0, 'slot', r.slot, 'bulk', true));

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
     SET bonus_amount = coalesce(bonus_amount, 0) + v_total,
         pending_mining = coalesce(pending_mining, 0) + v_total
   WHERE user_id = _user_id;

  INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
  SELECT _user_id, v_total, v_total, 0,
         coalesce(accrued_amount, 0) - coalesce(withdrawn_amount, 0),
         'mining', 'সব ঘরের মাইনিং → পেন্ডিং ব্যালেন্স ক্লেইম'
    FROM public.mining_state WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'mining', v_total, 'slots', v_slots, 'locked_slots', v_locked_slots);
END;
$function$;

-- 4) Slot reward: bonus → main instantly, mining → pending pocket
CREATE OR REPLACE FUNCTION public.claim_slot_reward(_user_id uuid, _task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bonus numeric := 0;
  v_mining numeric := 0;
  v_locked numeric := 0;
  v_total numeric := 0;
  v_slot int;
  v_ok boolean := false;
BEGIN
  PERFORM public.settle_mining(_user_id);

  SELECT slot, coalesce(whitelist_ok, false), greatest(coalesce(locked_mined, 0), 0)
    INTO v_slot, v_ok, v_locked
    FROM public.tasks
   WHERE id = _task_id AND user_id = _user_id
   FOR UPDATE;

  IF v_slot IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reverify_required');
  END IF;

  PERFORM 1
    FROM public.slot_claims
   WHERE user_id = _user_id AND task_id = _task_id AND status = 'pending'
   FOR UPDATE;

  SELECT coalesce(sum(bonus_amount), 0), coalesce(sum(mining_amount), 0)
    INTO v_bonus, v_mining
    FROM public.slot_claims
   WHERE user_id = _user_id AND task_id = _task_id AND status = 'pending';

  v_bonus := floor(greatest(v_bonus, 0) * 100) / 100;
  v_mining := floor(greatest(v_mining, 0) * 100) / 100 + floor(v_locked * 100) / 100;
  v_total := v_bonus + v_mining;

  IF v_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_to_claim');
  END IF;

  UPDATE public.slot_claims
     SET status = 'claimed', claimed_at = now()
   WHERE user_id = _user_id AND task_id = _task_id AND status = 'pending';

  IF v_locked > 0 THEN
    UPDATE public.tasks
       SET locked_mined = greatest(coalesce(locked_mined, 0) - floor(v_locked * 100) / 100, 0)
     WHERE id = _task_id AND user_id = _user_id;
  END IF;

  PERFORM set_config('app.balance_change_source', 'slot_claim', true);

  UPDATE public.mining_state
     SET accrued_amount = coalesce(accrued_amount, 0) + v_bonus,
         bonus_amount   = coalesce(bonus_amount, 0) + v_total,
         pending_mining = coalesce(pending_mining, 0) + v_mining
   WHERE user_id = _user_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, v_bonus, 'slot_claim', _task_id,
          jsonb_build_object('bonus', v_bonus, 'mining_moved_to_pending', v_mining, 'total', v_total, 'slot', v_slot));

  IF v_mining > 0 THEN
    INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
    SELECT _user_id, v_mining, v_mining, 0,
           coalesce(accrued_amount, 0) - coalesce(withdrawn_amount, 0),
           'mining', 'ঘরের মাইনিং → পেন্ডিং ব্যালেন্স ক্লেইম'
      FROM public.mining_state WHERE user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'bonus', v_bonus, 'mining', v_mining, 'total', v_total);
END;
$function$;

-- 5) Referral commission claim → pending pocket
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
         pending_mining = coalesce(pending_mining, 0) + v_amount,
         mining_unlocked = greatest(coalesce(mining_unlocked, 0) - v_amount, 0)
   WHERE user_id = _user_id;

  INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
  SELECT _user_id, v_amount, 0, v_amount,
         coalesce(accrued_amount, 0) - coalesce(withdrawn_amount, 0),
         'mining', 'রেফারেল ১০% কমিশন → মেইন ব্যালেন্স ক্লেইম'
    FROM public.mining_state WHERE user_id = _user_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
  VALUES (_user_id, 0, 'mining_claim',
          jsonb_build_object('moved_to_pending', v_amount, 'self', 0, 'referral_commission', v_amount, 'reason', 'referral_commission_claim'));

  RETURN jsonb_build_object('ok', true, 'amount', v_amount, 'self', 0, 'referral', v_amount);
END;
$function$;

-- 6) Revert on unwhitelist: take from the pending pocket first
CREATE OR REPLACE FUNCTION public.revert_slot_claim_on_unwhitelist(_user_id uuid, _task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_claimed_total numeric := 0;
  v_claimed_bonus numeric := 0;
  v_rev_total numeric := 0;
  v_rev_bonus numeric := 0;
  v_net_total numeric := 0;
  v_net_bonus numeric := 0;
  v_net_mining numeric := 0;
  v_slot int;
  v_bonus_avail numeric := 0;
  v_pending_cut numeric := 0;
BEGIN
  SELECT slot INTO v_slot FROM public.tasks WHERE id = _task_id AND user_id = _user_id;
  IF v_slot IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT coalesce(sum(coalesce((metadata->>'total')::numeric, 0)), 0),
         coalesce(sum(coalesce((metadata->>'bonus')::numeric, 0)), 0)
    INTO v_claimed_total, v_claimed_bonus
    FROM public.balance_ledger
   WHERE user_id = _user_id AND source_id = _task_id AND type = 'slot_claim';

  SELECT coalesce(sum(coalesce((metadata->>'total')::numeric, 0)), 0),
         coalesce(sum(coalesce((metadata->>'bonus')::numeric, 0)), 0)
    INTO v_rev_total, v_rev_bonus
    FROM public.balance_ledger
   WHERE user_id = _user_id AND source_id = _task_id AND type = 'slot_claim_reverted';

  v_net_total := floor(greatest(v_claimed_total - v_rev_total, 0) * 100) / 100;
  v_net_bonus := floor(greatest(v_claimed_bonus - v_rev_bonus, 0) * 100) / 100;
  IF v_net_total <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'reverted', 0);
  END IF;

  SELECT greatest(coalesce(bonus_amount, 0), 0) INTO v_bonus_avail
    FROM public.mining_state WHERE user_id = _user_id FOR UPDATE;
  v_net_total := least(v_net_total, v_bonus_avail);
  IF v_net_total <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'reverted', 0);
  END IF;
  v_net_bonus := least(v_net_bonus, v_net_total);
  v_net_mining := greatest(v_net_total - v_net_bonus, 0);

  PERFORM set_config('app.balance_change_source', 'slot_claim_reverted', true);

  SELECT least(greatest(coalesce(pending_mining, 0), 0), v_net_mining) INTO v_pending_cut
    FROM public.mining_state WHERE user_id = _user_id;

  UPDATE public.mining_state
     SET bonus_amount = greatest(coalesce(bonus_amount, 0) - v_net_total, 0),
         accrued_amount = greatest(coalesce(accrued_amount, 0) - v_net_bonus, 0),
         pending_mining = greatest(coalesce(pending_mining, 0) - v_pending_cut, 0)
   WHERE user_id = _user_id;

  INSERT INTO public.slot_claims (user_id, task_id, slot, bonus_amount, mining_amount, status)
  VALUES (_user_id, _task_id, v_slot, v_net_bonus, v_net_mining, 'pending');

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -v_net_bonus, 'slot_claim_reverted', _task_id,
          jsonb_build_object('total', v_net_total, 'bonus', v_net_bonus, 'mining', v_net_mining, 'slot', v_slot));

  RETURN jsonb_build_object('ok', true, 'reverted', v_net_total, 'bonus', v_net_bonus, 'mining', v_net_mining);
END;
$function$;

-- 7) Withdrawal during the 1st–3rd window may use main + pending pocket
CREATE OR REPLACE FUNCTION public.create_withdrawal_request_atomic(_user_id uuid, _gross numeric, _payout numeric, _provider wallet_provider, _wallet_number text, _admin_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.bonus_settings%ROWTYPE;
  v_debt numeric := 0; v_id uuid; v_breakdown jsonb;
  v_main numeric := 0; v_pending numeric := 0; v_avail numeric := 0;
  v_main_used numeric := 0; v_pending_used numeric := 0;
BEGIN
  IF _gross IS NULL OR _gross <= 0 OR _payout IS NULL OR _payout <= 0 OR _payout > _gross THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সঠিক withdrawal amount দিন');
  END IF;

  IF NOT public.mining_withdraw_window_open(now()) THEN
    RETURN jsonb_build_object('ok', false, 'error',
      '⏳ উইথড্র এখন বন্ধ — প্রতি মাসের ১ তারিখ রাত ১২:০০টা থেকে ৩ তারিখ রাত ১০:০০টা পর্যন্ত উইথড্র চালু থাকে। পরের উইন্ডোর কাউন্টডাউন উইথড্র পেজে দেখা যাবে।');
  END IF;

  SELECT * INTO s FROM public.bonus_settings WHERE id = 'default';
  IF coalesce(s.withdraw_enabled, true) = false
     AND (s.withdraw_off_until IS NULL OR s.withdraw_off_until > now()) THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(s.withdraw_off_message, 'উইথড্র সাময়িকভাবে বন্ধ'));
  END IF;

  PERFORM public.settle_mining(_user_id);

  SELECT coalesce(sum(amount), 0) INTO v_debt
    FROM public.user_debts WHERE user_id = _user_id AND status IN ('active', 'claimed');
  IF v_debt > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'অ্যাকাউন্টে warning/ঋণ আছে');
  END IF;

  v_breakdown := public.get_user_balance_breakdown(_user_id);
  v_main := coalesce((v_breakdown->>'bonus_part')::numeric, 0);
  v_pending := coalesce((v_breakdown->>'pending_part')::numeric, 0);
  v_avail := v_main + v_pending;

  IF v_avail < _gross THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'মেইন + পেন্ডিং ব্যালেন্স থেকেই উইথড্র হয়। মাইনিং ব্যালেন্স আগে ক্লেইম করুন। এখন তোলা যাবে: '
      || greatest(floor(v_avail),0)::text || '৳');
  END IF;

  v_main_used := least(v_main, _gross);
  v_pending_used := greatest(_gross - v_main_used, 0);

  INSERT INTO public.withdrawals (user_id, amount, provider, wallet_number, status, admin_note,
                                  src_main, src_mining, src_referral)
  VALUES (_user_id, _payout, _provider, _wallet_number, 'pending', _admin_note,
          round(v_main_used, 2), round(v_pending_used, 2), 0)
  RETURNING id INTO v_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -_gross, 'withdrawal', v_id,
          jsonb_build_object('gross', _gross, 'payout', _payout, 'fee', _gross - _payout,
                             'mining_part', v_pending_used, 'main_part', v_main_used, 'referral_part', 0));

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount, 0) + _gross,
         pending_mining = greatest(coalesce(pending_mining, 0) - v_pending_used, 0)
   WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'gross', _gross, 'payout', _payout,
                            'main_part', v_main_used, 'mining_part', v_pending_used, 'referral_part', 0);
END;
$function$;