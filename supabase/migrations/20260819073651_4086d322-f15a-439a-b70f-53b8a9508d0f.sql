ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS src_main numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS src_mining numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS src_referral numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.create_withdrawal_request_atomic(_user_id uuid, _gross numeric, _payout numeric, _provider wallet_provider, _wallet_number text, _admin_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.bonus_settings%ROWTYPE;
  v_debt numeric := 0;
  v_balance numeric := 0;
  v_id uuid;
  v_breakdown jsonb;
  v_main numeric := 0;
  v_avail_mining numeric := 0;
  v_mining_used numeric := 0;
  v_main_used numeric := 0;
  v_ref_avail numeric := 0;
  v_ref_used numeric := 0;
BEGIN
  IF _gross IS NULL OR _gross <= 0 OR _payout IS NULL OR _payout <= 0 OR _payout > _gross THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সঠিক withdrawal amount দিন');
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
  v_balance := (v_breakdown->>'current_balance')::numeric;
  v_main := (v_breakdown->>'bonus_part')::numeric;
  v_avail_mining := (v_breakdown->>'mining_available')::numeric;
  v_ref_avail := coalesce((v_breakdown->>'referral_mining_available')::numeric, 0);

  IF v_balance < _gross THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  v_mining_used := greatest(_gross - v_main, 0);
  IF v_mining_used > v_avail_mining THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'মাইনিং ব্যালেন্সের একটি অংশ লক — যে স্লট রি-ভেরিফাই করবেন, সেই স্লটের মাইনিং আনলক হবে। এখন তোলা যাবে: '
      || floor(v_main + v_avail_mining)::text || '৳');
  END IF;

  v_main_used := _gross - v_mining_used;
  -- Referral commission is spent first out of the mining part, so the user can
  -- always see how much of a withdraw came from referral 10% commission.
  v_ref_used := least(v_mining_used, greatest(v_ref_avail, 0));

  INSERT INTO public.withdrawals (user_id, amount, provider, wallet_number, status, admin_note,
                                  src_main, src_mining, src_referral)
  VALUES (_user_id, _payout, _provider, _wallet_number, 'pending', _admin_note,
          round(v_main_used, 2), round(v_mining_used, 2), round(v_ref_used, 2))
  RETURNING id INTO v_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -_gross, 'withdrawal', v_id,
          jsonb_build_object('gross', _gross, 'payout', _payout, 'fee', _gross - _payout,
                             'mining_part', v_mining_used, 'main_part', v_main_used,
                             'referral_part', v_ref_used));

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount, 0) + _gross,
         mining_withdrawn = coalesce(mining_withdrawn, 0) + v_mining_used,
         mining_unlocked = greatest(coalesce(mining_unlocked, 0) - v_mining_used, 0)
   WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'gross', _gross, 'payout', _payout,
                            'main_part', v_main_used, 'mining_part', v_mining_used, 'referral_part', v_ref_used);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_welcome_bonuses(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  s public.bonus_settings%ROWTYPE;
  v_first_count integer := 0;
  v_reverify_count integer := 0;
  self_award numeric := 0;
  ref_award numeric := 0;
  reverify_award numeric := 0;
  in_promo boolean := false;
BEGIN
  SELECT * INTO s FROM public.bonus_settings WHERE id = 'default';
  IF coalesce(s.bonus_enabled, true) = false THEN
    RETURN jsonb_build_object('self_first_amount',0,'referrer_amount',0,'reverify_amount',0,'disabled',true);
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND OR coalesce(p.banned, false) THEN
    RETURN jsonb_build_object('self_first_amount',0,'referrer_amount',0,'reverify_amount',0);
  END IF;

  -- First-verify bonus (self + referrer) is earned by 10 whitelisted FIRST
  -- verifications; re-verification is a separate bonus and must not be required
  -- here (that mismatch was silently blocking referral bonuses).
  SELECT count(DISTINCT t.slot) FILTER (WHERE t.initial_verify_at IS NOT NULL AND coalesce(t.whitelist_ok, true) = true AND t.wallet_address IS NOT NULL),
         count(DISTINCT t.slot) FILTER (WHERE coalesce(t.reverify_count,0) > 0 AND coalesce(t.whitelist_ok,true) AND t.wallet_address IS NOT NULL)
    INTO v_first_count, v_reverify_count
    FROM public.tasks t WHERE t.user_id = _user_id AND t.slot <= 10;

  in_promo := coalesce(s.promo_active,false)
              AND s.promo_start_at IS NOT NULL AND s.promo_end_at IS NOT NULL
              AND now() BETWEEN s.promo_start_at AND s.promo_end_at;

  IF v_first_count >= 10 AND NOT coalesce(p.bonus_first_verify_self_claimed,false) THEN
    self_award := greatest(CASE WHEN in_promo AND s.promo_first_verify_bonus IS NOT NULL THEN s.promo_first_verify_bonus ELSE coalesce(s.first_verify_bonus,50) END,0);
    UPDATE public.profiles SET bonus_first_verify_self_claimed=true WHERE id=_user_id;
    PERFORM public.credit_bonus_balance(_user_id, self_award, 'bonus', NULL, '{"reason":"first_verify_self"}');
  END IF;

  IF v_first_count >= 10 AND p.referrer_bonus_paid_at IS NULL THEN
    UPDATE public.profiles
       SET bonus_first_verify_claimed = true,
           referrer_bonus_paid_at = now()
     WHERE id = _user_id;
    IF p.referred_by IS NOT NULL AND p.referred_by <> _user_id THEN
      PERFORM 1 FROM public.profiles WHERE id=p.referred_by FOR UPDATE;
      ref_award := greatest(CASE WHEN in_promo AND s.promo_referrer_bonus IS NOT NULL THEN s.promo_referrer_bonus ELSE coalesce(s.referrer_bonus,100) END,0);
      PERFORM public.credit_bonus_balance(p.referred_by, ref_award, 'referral_bonus', NULL,
        jsonb_build_object('referee_id', _user_id, 'rate', ref_award, 'paid_at', now()));
    END IF;
  END IF;

  IF v_reverify_count >= 10 AND NOT coalesce(p.bonus_reverify_claimed,false) THEN
    reverify_award := public.claim_reverify_bonus(_user_id);
  END IF;

  RETURN jsonb_build_object('self_first_amount',self_award,'referrer_amount',ref_award,'reverify_amount',reverify_award);
END;
$$;