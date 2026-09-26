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
  v_window boolean := false;
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
  v_main := coalesce((v_breakdown->>'bonus_part')::numeric, 0);
  v_pending := coalesce((v_breakdown->>'pending_part')::numeric, 0);
  v_window := public.mining_withdraw_window_open(now());
  v_avail := v_main + CASE WHEN v_window THEN v_pending ELSE 0 END;

  IF v_avail < _gross THEN
    RETURN jsonb_build_object('ok', false, 'error',
      CASE WHEN v_window THEN
        'মেইন + পেন্ডিং ব্যালেন্স থেকেই উইথড্র হয়। মাইনিং ব্যালেন্স আগে ক্লেইম করুন। এখন তোলা যাবে: '
      ELSE
        'মাইনিং উইথড্র প্রতি মাসের ১–৩ তারিখে খোলে। এখন শুধু বোনাস ব্যালান্স থেকে তোলা যাবে: '
      END || greatest(floor(v_avail),0)::text || '৳');
  END IF;

  IF v_window THEN
    v_pending_used := least(v_pending, _gross);
    v_main_used := greatest(_gross - v_pending_used, 0);
  ELSE
    v_pending_used := 0;
    v_main_used := _gross;
  END IF;

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