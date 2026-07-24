
CREATE OR REPLACE FUNCTION public.create_recharge_request(_user uuid, _mobile text, _operator text, _connection_type text, _amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s_bal numeric;
  s_debt numeric;
  rid uuid;
  mob_clean text;
BEGIN
  IF _amount IS NULL OR _amount < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সর্বনিম্ন ২০৳ রিচার্জ করা যাবে');
  END IF;
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
  SELECT (coalesce(accrued_amount,0) - coalesce(withdrawn_amount,0)) INTO s_bal
    FROM public.mining_state WHERE user_id = _user FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _user AND status = 'active';
  s_bal := coalesce(s_bal,0) - coalesce(s_debt,0);
  IF s_bal < _amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  UPDATE public.mining_state SET withdrawn_amount = coalesce(withdrawn_amount,0) + _amount WHERE user_id = _user;

  INSERT INTO public.recharges (user_id, mobile, operator, connection_type, amount, status)
    VALUES (_user, mob_clean, _operator, _connection_type, _amount, 'pending')
    RETURNING id INTO rid;

  RETURN jsonb_build_object('ok', true, 'recharge_id', rid);
END;
$function$;

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
  INSERT INTO public.mining_state (user_id, accrued_amount) VALUES (r_id, _amount)
    ON CONFLICT (user_id) DO UPDATE SET accrued_amount = public.mining_state.accrued_amount + _amount;

  INSERT INTO public.transfers (sender_id, receiver_id, amount, note)
    VALUES (_sender, r_id, _amount, nullif(trim(coalesce(_note,'')), ''))
    RETURNING id INTO transfer_id;

  RETURN jsonb_build_object('ok', true, 'transfer_id', transfer_id,
    'receiver_name', coalesce(r_display, 'ইউজার'), 'amount', _amount);
END;
$function$;
