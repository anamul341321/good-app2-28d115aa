-- 1. Ensure get_user_balance_breakdown is consistent with spending logic
CREATE OR REPLACE FUNCTION public.get_user_balance_breakdown(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res jsonb;
BEGIN
  -- We aggregate from the balance_ledger to provide a consistent breakdown
  -- Spending (withdrawal, recharge, transfer_out) are negative amounts in ledger.
  -- Main/Bonus pool includes: welcome bonuses, re-verify bonuses, transfers IN.
  -- Mining pool includes: passive mining earnings, referral share of mining.
  -- Debits (negative amounts) apply to the total net balance.
  
  SELECT jsonb_build_object(
    'total_accrued', coalesce(sum(amount) FILTER (WHERE amount > 0), 0),
    'withdrawn_total', coalesce(abs(sum(amount) FILTER (WHERE amount < 0 AND type = 'withdrawal')), 0),
    'bonus_part', coalesce(sum(amount) FILTER (WHERE type IN ('bonus', 'referral_bonus', 'transfer_in')), 0),
    'mining_part', coalesce(sum(amount) FILTER (WHERE type IN ('mining', 'referral')), 0),
    'current_balance', coalesce(sum(amount), 0),
    'total_spent', coalesce(abs(sum(amount) FILTER (WHERE amount < 0)), 0)
  ) INTO res
  FROM public.balance_ledger
  WHERE user_id = _user_id;

  RETURN coalesce(res, '{"total_accrued":0,"withdrawn_total":0,"bonus_part":0,"mining_part":0,"current_balance":0,"total_spent":0}'::jsonb);
END;
$$;

-- 2. Ensure create_withdrawal_request_atomic uses the ledger for current_balance
CREATE OR REPLACE FUNCTION public.create_withdrawal_request_atomic(
  _user_id uuid,
  _gross numeric,
  _payout numeric,
  _provider public.wallet_provider,
  _wallet_number text,
  _admin_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.mining_state%ROWTYPE;
  s public.bonus_settings%ROWTYPE;
  v_debt numeric := 0;
  v_ledger_balance numeric := 0;
  v_day integer;
  v_id uuid;
  v_breakdown jsonb;
  v_available numeric := 0;
BEGIN
  IF _gross IS NULL OR _gross <= 0 OR _payout IS NULL OR _payout <= 0 OR _payout > _gross THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সঠিক withdrawal amount দিন');
  END IF;

  SELECT * INTO s FROM public.bonus_settings WHERE id = 'default';
  IF coalesce(s.withdraw_enabled, true) = false
     AND (s.withdraw_off_until IS NULL OR s.withdraw_off_until > now()) THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(s.withdraw_off_message, 'উইথড্র সাময়িকভাবে বন্ধ'));
  END IF;

  PERFORM public.settle_mining(_user_id);
  
  -- Get audited ledger balance
  SELECT coalesce(sum(amount), 0) INTO v_ledger_balance
    FROM public.balance_ledger
   WHERE user_id = _user_id;

  SELECT coalesce(sum(amount), 0) INTO v_debt
    FROM public.user_debts
   WHERE user_id = _user_id AND status IN ('active', 'claimed');

  IF v_debt > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'অ্যাকাউন্টে warning/ঋণ আছে');
  END IF;

  IF v_ledger_balance < _gross THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  -- Window check
  v_day := extract(day from (now() AT TIME ZONE 'Asia/Dhaka'))::integer;
  
  -- Use breakdown for locked balance logic
  v_breakdown := public.get_user_balance_breakdown(_user_id);
  
  -- If not 1-3, only bonus_part is available
  IF v_day > 3 THEN
     v_available := (v_breakdown->>'bonus_part')::numeric;
     IF _gross > v_available THEN
        RETURN jsonb_build_object('ok', false, 'error', 'মাইনিং ব্যালেন্স লক—শুধু মাসের ১–৩ তারিখে withdraw করা যাবে');
     END IF;
  END IF;

  -- Create withdrawal
  INSERT INTO public.withdrawals (user_id, amount, provider, wallet_number, status, admin_note)
  VALUES (_user_id, _payout, _provider, _wallet_number, 'pending', _admin_note)
  RETURNING id INTO v_id;

  -- Log to ledger (negative amount for debit)
  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -_gross, 'withdrawal', v_id, jsonb_build_object('gross', _gross, 'payout', _payout, 'fee', _gross - _payout));

  -- Update mining_state legacy columns for backward compatibility in some admin UIs
  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount, 0) + _gross
   WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'gross', _gross, 'payout', _payout);
END;
$$;
