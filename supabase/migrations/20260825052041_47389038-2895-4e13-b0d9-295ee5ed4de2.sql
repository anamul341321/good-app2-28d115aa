CREATE OR REPLACE FUNCTION public.send_balance_transfer(_sender uuid, _target text, _amount numeric, _note text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r_id uuid; target_clean text; transfer_id uuid; r_display text;
  v_fee numeric; v_total numeric; v_break jsonb;
  v_main numeric := 0; s_debt numeric := 0;
BEGIN
  IF _amount IS NULL OR _amount < 15 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সর্বনিম্ন ১৫৳ পাঠানো যাবে');
  END IF;

  v_fee := floor(_amount * 0.2);
  v_total := _amount + v_fee;

  target_clean := trim(coalesce(_target, ''));
  IF target_clean = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UID বা ফোন নম্বর দিন');
  END IF;

  IF target_clean ~ '^\d+$' THEN
    SELECT id, display_name INTO r_id, r_display FROM public.profiles WHERE uid_seq::text = target_clean LIMIT 1;
  END IF;
  IF r_id IS NULL THEN
    SELECT id, display_name INTO r_id, r_display FROM public.profiles WHERE phone_number = target_clean LIMIT 1;
  END IF;
  IF r_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'এই UID/ফোন নম্বরে কোনো ইউজার পাওয়া যায়নি');
  END IF;
  IF r_id = _sender THEN
    RETURN jsonb_build_object('ok', false, 'error', 'নিজেকে পাঠানো যাবে না');
  END IF;

  PERFORM public.settle_mining(_sender);

  v_break := public.get_user_balance_breakdown(_sender);
  v_main := coalesce((v_break->>'bonus_part')::numeric, 0);

  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _sender AND status = 'active';
  v_main := v_main - coalesce(s_debt,0);

  IF v_main < v_total THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'শুধু মেইন ব্যালেন্স দিয়ে পাঠানো যাবে। মাইনিং ব্যালেন্স আগে "মেইন ব্যালেন্সে ক্লেইম" করুন। এখন পাঠানো যাবে: '
      || greatest(floor(v_main),0)::text || '৳');
  END IF;

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount,0) + v_total
   WHERE user_id = _sender;

  INSERT INTO public.transfers (sender_id, receiver_id, amount, note, fee_amount)
    VALUES (_sender, r_id, _amount, nullif(trim(coalesce(_note,'')), ''), v_fee)
    RETURNING id INTO transfer_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_sender, -v_total, 'transfer_out', transfer_id,
    jsonb_build_object('target_uid', target_clean, 'fee', v_fee, 'mining_part', 0));

  PERFORM public.credit_bonus_balance(r_id, _amount, 'transfer_in', transfer_id, jsonb_build_object('sender_id', _sender));

  RETURN jsonb_build_object('ok', true, 'transfer_id', transfer_id,
    'receiver_name', coalesce(r_display, 'ইউজার'), 'amount', _amount, 'fee', v_fee);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_recharge_request(_user uuid, _mobile text, _operator text, _connection_type text, _amount numeric)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  rid uuid; mob_clean text; v_fee numeric; v_total numeric; v_break jsonb;
  v_main numeric := 0; s_debt numeric := 0;
BEGIN
  IF _amount IS NULL OR _amount < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সর্বনিম্ন ২০৳ রিচার্জ করা যাবে');
  END IF;

  v_fee := floor(_amount * 0.2);
  v_total := _amount + v_fee;

  mob_clean := regexp_replace(coalesce(_mobile,''), '\D', '', 'g');
  IF length(mob_clean) < 11 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সঠিক মোবাইল নম্বর দিন');
  END IF;
  IF _operator NOT IN ('grameenphone','robi','banglalink','airtel','teletalk') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'অপারেটর সিলেক্ট করুন');
  END IF;
  IF _connection_type NOT IN ('prepaid','postpaid') THEN
    _connection_type := 'prepaid';
  END IF;

  PERFORM public.settle_mining(_user);

  v_break := public.get_user_balance_breakdown(_user);
  v_main := coalesce((v_break->>'bonus_part')::numeric, 0);

  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _user AND status = 'active';
  v_main := v_main - coalesce(s_debt,0);

  IF v_main < v_total THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'শুধু মেইন ব্যালেন্স দিয়ে রিচার্জ করা যাবে। মাইনিং ব্যালেন্স আগে "মেইন ব্যালেন্সে ক্লেইম" করুন। এখন রিচার্জ করা যাবে: '
      || greatest(floor(v_main),0)::text || '৳');
  END IF;

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount,0) + v_total
   WHERE user_id = _user;

  INSERT INTO public.recharges (user_id, mobile, operator, connection_type, amount, fee_amount, total_deducted, status)
    VALUES (_user, mob_clean, _operator, _connection_type, _amount, v_fee, v_total, 'pending')
    RETURNING id INTO rid;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user, -v_total, 'recharge', rid,
    jsonb_build_object('mobile', mob_clean, 'amount', _amount, 'fee', v_fee, 'mining_part', 0));

  RETURN jsonb_build_object('ok', true, 'recharge_id', rid, 'fee', v_fee, 'total', v_total, 'mining_part', 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_card(_user_id uuid, _product_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  p public.card_products%ROWTYPE; v_code public.card_codes%ROWTYPE;
  v_break jsonb; v_main numeric := 0; v_debt numeric := 0;
BEGIN
  SELECT * INTO p FROM public.card_products WHERE id = _product_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'কার্ডটি পাওয়া যায়নি');
  END IF;

  PERFORM public.settle_mining(_user_id);

  v_break := public.get_user_balance_breakdown(_user_id);
  v_main := coalesce((v_break->>'bonus_part')::numeric, 0);
  SELECT coalesce(sum(amount), 0) INTO v_debt FROM public.user_debts WHERE user_id = _user_id AND status = 'active';
  v_main := v_main - v_debt;

  IF v_main < p.selling_price THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'শুধু মেইন ব্যালেন্স দিয়ে কার্ড কেনা যাবে। মাইনিং ব্যালেন্স আগে মেইন ব্যালেন্সে ক্লেইম করুন');
  END IF;

  SELECT * INTO v_code FROM public.card_codes
   WHERE product_id = _product_id AND is_used = false
   ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'স্টক শেষ');
  END IF;

  UPDATE public.card_codes SET is_used = true, used_by = _user_id, used_at = now() WHERE id = v_code.id;

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount, 0) + p.selling_price
   WHERE user_id = _user_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -p.selling_price, 'card_purchase', v_code.id,
          jsonb_build_object('product_id', p.id, 'name', p.name, 'operator', p.operator, 'card_type', p.card_type));

  RETURN jsonb_build_object('ok', true, 'code', v_code.code, 'name', p.name,
    'price', p.selling_price, 'operator', p.operator, 'card_type', p.card_type, 'amount_label', p.amount_label);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_withdrawal_request_atomic(_user_id uuid, _gross numeric, _payout numeric, _provider wallet_provider, _wallet_number text, _admin_note text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  s public.bonus_settings%ROWTYPE;
  v_debt numeric := 0; v_id uuid; v_breakdown jsonb; v_main numeric := 0;
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