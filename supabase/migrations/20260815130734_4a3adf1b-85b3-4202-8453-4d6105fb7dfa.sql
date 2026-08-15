-- 1. Trace existing accrued_amount into ledger as 'initial_trace' for all users
INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
SELECT user_id, accrued_amount, 'initial_trace', '{"reason":"historical_balance_snapshot"}'::jsonb
FROM public.mining_state
WHERE accrued_amount > 0
ON CONFLICT DO NOTHING;

-- 2. Update send_balance_transfer to log to ledger
CREATE OR REPLACE FUNCTION public.send_balance_transfer(_sender uuid, _target text, _amount numeric, _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r_id uuid;
  s_bal numeric;
  s_debt numeric;
  target_clean text;
  transfer_id uuid;
  r_display text;
BEGIN
  IF _amount IS NULL OR _amount < 15 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সর্বনিম্ন ১৫৳ পাঠানো যাবে');
  END IF;

  target_clean := trim(coalesce(_target, ''));
  IF target_clean = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UID বা ফোন নম্বর দিন');
  END IF;

  IF target_clean ~ '^\d+$' THEN
    SELECT id, display_name INTO r_id, r_display
      FROM public.profiles WHERE uid_seq::text = target_clean LIMIT 1;
  END IF;
  IF r_id IS NULL THEN
    SELECT id, display_name INTO r_id, r_display
      FROM public.profiles WHERE phone_number = target_clean LIMIT 1;
  END IF;
  IF r_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'এই UID/ফোন নম্বরে কোনো ইউজার পাওয়া যায়নি');
  END IF;
  IF r_id = _sender THEN
    RETURN jsonb_build_object('ok', false, 'error', 'নিজেকে পাঠানো যাবে না');
  END IF;

  PERFORM public.settle_mining(_sender);

  SELECT (coalesce(accrued_amount,0) - coalesce(withdrawn_amount,0)) INTO s_bal
    FROM public.mining_state WHERE user_id = _sender FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _sender AND status = 'active';
  s_bal := coalesce(s_bal,0) - coalesce(s_debt,0);

  IF s_bal < _amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  UPDATE public.mining_state SET withdrawn_amount = coalesce(withdrawn_amount,0) + _amount WHERE user_id = _sender;

  INSERT INTO public.transfers (sender_id, receiver_id, amount, note)
    VALUES (_sender, r_id, _amount, nullif(trim(coalesce(_note,'')), ''))
    RETURNING id INTO transfer_id;

  -- Log sender debit
  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_sender, -_amount, 'transfer_out', transfer_id, jsonb_build_object('target_uid', target_clean));

  -- Received money is spendable cash
  PERFORM public.credit_bonus_balance(r_id, _amount, 'transfer_in', transfer_id, jsonb_build_object('sender_id', _sender));

  RETURN jsonb_build_object('ok', true, 'transfer_id', transfer_id,
    'receiver_name', coalesce(r_display, 'ইউজার'), 'amount', _amount);
END;
$function$;

-- 3. Update create_withdrawal_request_atomic to log to ledger
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
  v_balance numeric := 0;
  v_main_withdrawn numeric := 0;
  v_main_available numeric := 0;
  v_available numeric := 0;
  v_from_main numeric := 0;
  v_from_mining numeric := 0;
  v_day integer;
  v_id uuid;
BEGIN
  IF _gross IS NULL OR _gross <= 0 OR _payout IS NULL OR _payout <= 0 OR _payout > _gross THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সঠিক withdrawal amount দিন');
  END IF;

  SELECT * INTO s FROM public.bonus_settings WHERE id = 'default';
  IF coalesce(s.withdraw_enabled, true) = false
     AND (s.withdraw_off_until IS NULL OR s.withdraw_off_until > now()) THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(s.withdraw_off_message, 'উইথড্র সাময়িকভাবে বন্ধ'));
  END IF;

  IF _provider = 'bkash' AND coalesce(s.bkash_enabled, true) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(s.bkash_off_message, 'বিকাশ withdraw বন্ধ'));
  END IF;
  IF _provider = 'nagad' AND coalesce(s.nagad_enabled, true) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(s.nagad_off_message, 'নগদ withdraw বন্ধ'));
  END IF;
  IF _provider = 'usdt' AND coalesce(s.usdt_enabled, true) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(s.usdt_off_message, 'USDT withdraw বন্ধ'));
  END IF;

  PERFORM public.settle_mining(_user_id);
  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ব্যালেন্স পাওয়া যায়নি');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_debt
    FROM public.user_debts
   WHERE user_id = _user_id AND status IN ('active', 'claimed');
  IF v_debt > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'অ্যাকাউন্টে warning/ঋণ আছে');
  END IF;

  v_balance := greatest(coalesce(m.accrued_amount, 0) - coalesce(m.withdrawn_amount, 0), 0);
  v_main_withdrawn := greatest(coalesce(m.withdrawn_amount, 0) - least(coalesce(m.mining_withdrawn, 0), coalesce(m.withdrawn_amount, 0)), 0);
  v_main_available := greatest(coalesce(m.bonus_amount, 0) - v_main_withdrawn, 0);
  v_main_available := least(v_main_available, v_balance);
  v_day := extract(day from (now() AT TIME ZONE 'Asia/Dhaka'))::integer;
  v_available := CASE WHEN v_day <= 3 THEN v_balance ELSE v_main_available END;

  IF _gross > v_available THEN
    IF v_day > 3 AND _gross <= v_balance THEN
      RETURN jsonb_build_object('ok', false, 'error', 'মাইনিং ব্যালেন্স লক—শুধু মাসের ১–৩ তারিখে withdraw করা যাবে');
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত withdrawable balance নেই');
  END IF;

  v_from_main := least(_gross, v_main_available);
  v_from_mining := _gross - v_from_main;

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount, 0) + _gross,
         mining_withdrawn = coalesce(mining_withdrawn, 0) + v_from_mining
   WHERE user_id = _user_id;

  INSERT INTO public.withdrawals (user_id, amount, provider, wallet_number, status, admin_note)
  VALUES (_user_id, _payout, _provider, _wallet_number, 'pending', _admin_note)
  RETURNING id INTO v_id;

  -- Log to ledger (negative amount for debit)
  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -_gross, 'withdrawal', v_id, jsonb_build_object('gross', _gross, 'payout', _payout, 'fee', _gross - _payout));

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'gross', _gross, 'payout', _payout);
END;
$$;
