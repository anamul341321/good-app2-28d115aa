CREATE OR REPLACE FUNCTION public.create_withdrawal_request_atomic(_user_id uuid, _gross numeric, _payout numeric, _provider wallet_provider, _wallet_number text, _admin_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.bonus_settings%ROWTYPE;
  v_debt numeric := 0; v_id uuid; v_breakdown jsonb; v_main numeric := 0;
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

  IF v_main < _gross THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'শুধু মেইন ব্যালেন্স উইথড্র করা যাবে। মাইনিং ব্যালেন্স আগে "মেইন ব্যালেন্সে ক্লেইম" করুন। এখন তোলা যাবে: '
      || greatest(floor(v_main),0)::text || '৳');
  END IF;

  INSERT INTO public.withdrawals (user_id, amount, provider, wallet_number, status, admin_note,
                                  src_main, src_mining, src_referral)
  VALUES (_user_id, _payout, _provider, _wallet_number, 'pending', _admin_note,
          round(_gross, 2), 0, 0)
  RETURNING id INTO v_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -_gross, 'withdrawal', v_id,
          jsonb_build_object('gross', _gross, 'payout', _payout, 'fee', _gross - _payout,
                             'mining_part', 0, 'main_part', _gross, 'referral_part', 0));

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount, 0) + _gross
   WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'gross', _gross, 'payout', _payout,
                            'main_part', _gross, 'mining_part', 0, 'referral_part', 0);
END;
$function$;