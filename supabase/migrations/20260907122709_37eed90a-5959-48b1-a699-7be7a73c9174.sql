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
  v_claimed_mining numeric := 0;
  v_mining_withdrawn numeric := 0;
  v_window boolean := false;
BEGIN
  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN '{"total_accrued":0,"withdrawn_total":0,"bonus_part":0,"mining_part":0,"pending_part":0,"mining_available":0,"mining_locked":0,"available_now":0,"current_balance":0,"total_spent":0,"window_open":false,"self_mining_total":0,"self_mining_locked":0,"self_mining_claimable":0,"self_mining_pending":0,"self_mining_claimed":0,"referral_mining_total":0,"referral_mining_available":0,"referral_mining_claimed":0}'::jsonb;
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
  v_mining_withdrawn := greatest(coalesce(m.mining_withdrawn, 0), 0);

  v_mining := least(greatest(v_slot_locked + v_ref_available, 0), v_bal);
  v_main := greatest(v_bal - v_mining, 0);

  -- ক্লেইম করা মাইনিং (স্লট + রেফারেল কমিশন) — উইথড্র হওয়া অংশ বাদ দিয়ে
  -- সবসময় পেন্ডিং পকেটেই থাকে, মেইন ব্যালেন্সে মেশে না।
  v_claimed_mining := greatest(v_slot_claimed + v_ref_claimed - v_mining_withdrawn, 0);
  v_pending := least(greatest(greatest(coalesce(m.pending_mining, 0), 0), v_claimed_mining), v_main);
  v_main := greatest(v_main - v_pending, 0);
  v_avail := least(v_ref_available, v_mining);
  v_window := public.mining_withdraw_window_open(now());

  RETURN jsonb_build_object(
    'total_accrued', coalesce(m.accrued_amount, 0),
    'withdrawn_total', v_withdrawn,
    'bonus_part', v_main,
    'pending_part', v_pending,
    'mining_part', v_mining,
    'mining_available', v_avail,
    'mining_locked', greatest(v_mining - v_avail, 0),
    'window_open', v_window,
    'available_now', v_main + CASE WHEN v_window THEN v_pending ELSE 0 END,
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

  -- উইন্ডো খোলা থাকলে আগে পেন্ডিং (মাইনিং) টাকা খরচ হবে, যাতে ৩ তারিখের পরে
  -- মেইন ব্যালেন্স নয় — শুধু বাকি মাইনিং টাকাই লক হয়ে পেন্ডিং-এ থাকে।
  v_pending_used := least(v_pending, _gross);
  v_main_used := greatest(_gross - v_pending_used, 0);

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
         mining_withdrawn = coalesce(mining_withdrawn, 0) + v_pending_used,
         pending_mining = greatest(coalesce(pending_mining, 0) - v_pending_used, 0)
   WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'gross', _gross, 'payout', _payout,
                            'main_part', v_main_used, 'mining_part', v_pending_used, 'referral_part', 0);
END;
$function$;

-- পুরোনো ক্লেইম করা মাইনিং টাকা পেন্ডিং পকেটে ফিরিয়ে আনা
UPDATE public.mining_state ms
   SET pending_mining = greatest(coalesce(ms.pending_mining, 0), c.claimed)
  FROM (
    SELECT s.user_id,
           greatest(coalesce(sum(greatest(s.mining_amount, 0)), 0)
                    - coalesce((SELECT greatest(m2.mining_withdrawn, 0) FROM public.mining_state m2 WHERE m2.user_id = s.user_id), 0), 0) AS claimed
      FROM public.slot_claims s
     WHERE s.status = 'claimed'
     GROUP BY s.user_id
  ) c
 WHERE ms.user_id = c.user_id;