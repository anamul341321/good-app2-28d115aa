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
  v_fee numeric;
  v_total numeric;
BEGIN
  IF _amount IS NULL OR _amount < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সর্বনিম্ন ২০৳ রিচার্জ করা যাবে');
  END IF;

  v_fee := floor(_amount * 0.1);
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
  SELECT (coalesce(accrued_amount,0) - coalesce(withdrawn_amount,0)) INTO s_bal
    FROM public.mining_state WHERE user_id = _user FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _user AND status = 'active';
  s_bal := coalesce(s_bal,0) - coalesce(s_debt,0);

  IF s_bal < v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount,0) + v_total
   WHERE user_id = _user;

  INSERT INTO public.recharges (user_id, mobile, operator, connection_type, amount, fee_amount, total_deducted, status)
    VALUES (_user, mob_clean, _operator, _connection_type, _amount, v_fee, v_total, 'pending')
    RETURNING id INTO rid;

  -- Log to ledger
  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user, -v_total, 'recharge', rid, jsonb_build_object('mobile', mob_clean, 'amount', _amount, 'fee', v_fee));

  RETURN jsonb_build_object('ok', true, 'recharge_id', rid);
END;
$function$;
