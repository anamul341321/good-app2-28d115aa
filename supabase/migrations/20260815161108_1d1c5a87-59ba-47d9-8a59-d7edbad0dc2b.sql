-- 1) Authoritative balance breakdown from mining_state (single source of truth)
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
  v_mining_withdrawn numeric := 0;
  v_main_withdrawn numeric := 0;
  v_main numeric := 0;
  v_mining numeric := 0;
BEGIN
  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN '{"total_accrued":0,"withdrawn_total":0,"bonus_part":0,"mining_part":0,"current_balance":0,"total_spent":0}'::jsonb;
  END IF;

  v_withdrawn := greatest(coalesce(m.withdrawn_amount, 0), 0);
  v_bonus := greatest(coalesce(m.bonus_amount, 0), 0);
  v_mining_withdrawn := least(greatest(coalesce(m.mining_withdrawn, 0), 0), v_withdrawn);
  v_bal := greatest(coalesce(m.accrued_amount, 0) - v_withdrawn, 0);

  v_main_withdrawn := greatest(v_withdrawn - v_mining_withdrawn, 0);
  v_main := greatest(least(v_bal, v_bonus - v_main_withdrawn), 0);
  v_mining := greatest(v_bal - v_main, 0);

  RETURN jsonb_build_object(
    'total_accrued', coalesce(m.accrued_amount, 0),
    'withdrawn_total', v_withdrawn,
    'bonus_part', v_main,
    'mining_part', v_mining,
    'current_balance', v_bal,
    'total_spent', v_withdrawn
  );
END;
$$;

-- 2) Withdrawal request must validate against the same authoritative balance
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
  s public.bonus_settings%ROWTYPE;
  v_debt numeric := 0;
  v_balance numeric := 0;
  v_day integer;
  v_id uuid;
  v_breakdown jsonb;
  v_main numeric := 0;
  v_mining_used numeric := 0;
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
    FROM public.user_debts
   WHERE user_id = _user_id AND status IN ('active', 'claimed');
  IF v_debt > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'অ্যাকাউন্টে warning/ঋণ আছে');
  END IF;

  v_breakdown := public.get_user_balance_breakdown(_user_id);
  v_balance := (v_breakdown->>'current_balance')::numeric;
  v_main := (v_breakdown->>'bonus_part')::numeric;

  IF v_balance < _gross THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  -- Mining part locked outside the 1st-3rd window (Asia/Dhaka)
  v_day := extract(day from (now() AT TIME ZONE 'Asia/Dhaka'))::integer;
  IF v_day > 3 AND _gross > v_main THEN
    RETURN jsonb_build_object('ok', false, 'error', 'মাইনিং ব্যালেন্স লক—শুধু মাসের ১–৩ তারিখে withdraw করা যাবে');
  END IF;

  v_mining_used := greatest(_gross - v_main, 0);

  INSERT INTO public.withdrawals (user_id, amount, provider, wallet_number, status, admin_note)
  VALUES (_user_id, _payout, _provider, _wallet_number, 'pending', _admin_note)
  RETURNING id INTO v_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -_gross, 'withdrawal', v_id,
          jsonb_build_object('gross', _gross, 'payout', _payout, 'fee', _gross - _payout, 'mining_part', v_mining_used));

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount, 0) + _gross,
         mining_withdrawn = coalesce(mining_withdrawn, 0) + v_mining_used
   WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'gross', _gross, 'payout', _payout);
END;
$$;

-- 3) Reconcile the audit ledger with the authoritative balance
INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
SELECT m.user_id,
       (greatest(coalesce(m.accrued_amount,0) - greatest(coalesce(m.withdrawn_amount,0),0), 0) - coalesce(l.total, 0)),
       'reconcile',
       jsonb_build_object('reason', 'ledger seed correction')
  FROM public.mining_state m
  LEFT JOIN (
    SELECT user_id, sum(amount) AS total FROM public.balance_ledger GROUP BY user_id
  ) l ON l.user_id = m.user_id
 WHERE abs(greatest(coalesce(m.accrued_amount,0) - greatest(coalesce(m.withdrawn_amount,0),0), 0) - coalesce(l.total, 0)) > 0.0001;