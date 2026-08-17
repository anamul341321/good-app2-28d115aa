ALTER TABLE public.tg_bot_settings
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS download_url text,
  ADD COLUMN IF NOT EXISTS download_notice text;

CREATE OR REPLACE FUNCTION public.create_recharge_request(_user uuid, _mobile text, _operator text, _connection_type text, _amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rid uuid;
  mob_clean text;
  v_fee numeric;
  v_total numeric;
  v_break jsonb;
  v_balance numeric := 0;
  v_main numeric := 0;
  v_mining_used numeric := 0;
  s_debt numeric := 0;
  v_today_mining integer := 0;
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
  v_balance := coalesce((v_break->>'current_balance')::numeric, 0);
  v_main := coalesce((v_break->>'bonus_part')::numeric, 0);

  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _user AND status = 'active';
  v_balance := v_balance - coalesce(s_debt,0);

  IF v_balance < v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  v_mining_used := greatest(v_total - v_main, 0);

  IF v_mining_used > 0 THEN
    IF v_mining_used > 50 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'মাইনিং ব্যালেন্স দিয়ে সর্বোচ্চ ৫০৳ রিচার্জ করা যাবে — বোনাস ব্যালেন্স দিয়ে বেশি নিতে পারবেন');
    END IF;

    SELECT count(*)::integer INTO v_today_mining
      FROM public.balance_ledger
     WHERE user_id = _user
       AND type = 'recharge'
       AND coalesce((metadata->>'mining_part')::numeric, 0) > 0
       AND (created_at AT TIME ZONE 'Asia/Dhaka')::date = (now() AT TIME ZONE 'Asia/Dhaka')::date;

    IF v_today_mining >= 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'মাইনিং ব্যালেন্স দিয়ে দিনে মাত্র ১ বার রিচার্জ করা যাবে');
    END IF;
  END IF;

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount,0) + v_total,
         mining_withdrawn = coalesce(mining_withdrawn,0) + v_mining_used
   WHERE user_id = _user;

  INSERT INTO public.recharges (user_id, mobile, operator, connection_type, amount, fee_amount, total_deducted, status)
    VALUES (_user, mob_clean, _operator, _connection_type, _amount, v_fee, v_total, 'pending')
    RETURNING id INTO rid;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user, -v_total, 'recharge', rid,
    jsonb_build_object('mobile', mob_clean, 'amount', _amount, 'fee', v_fee, 'mining_part', v_mining_used));

  RETURN jsonb_build_object('ok', true, 'recharge_id', rid, 'fee', v_fee, 'total', v_total, 'mining_part', v_mining_used);
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
  target_clean text;
  transfer_id uuid;
  r_display text;
  v_fee numeric;
  v_total numeric;
  v_break jsonb;
  v_balance numeric := 0;
  v_main numeric := 0;
  v_mining_used numeric := 0;
  s_debt numeric := 0;
  v_day integer;
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

  v_break := public.get_user_balance_breakdown(_sender);
  v_balance := coalesce((v_break->>'current_balance')::numeric, 0);
  v_main := coalesce((v_break->>'bonus_part')::numeric, 0);

  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _sender AND status = 'active';
  v_balance := v_balance - coalesce(s_debt,0);

  IF v_balance < v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  v_mining_used := greatest(v_total - v_main, 0);
  v_day := extract(day from (now() AT TIME ZONE 'Asia/Dhaka'))::integer;

  IF v_mining_used > 0 AND v_day > 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'মাইনিং ব্যালেন্স লক — শুধু মাসের ১–৩ তারিখে পাঠানো যাবে (বোনাস ব্যালেন্স যেকোনো সময়)');
  END IF;

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount,0) + v_total,
         mining_withdrawn = coalesce(mining_withdrawn,0) + v_mining_used
   WHERE user_id = _sender;

  INSERT INTO public.transfers (sender_id, receiver_id, amount, note, fee_amount)
    VALUES (_sender, r_id, _amount, nullif(trim(coalesce(_note,'')), ''), v_fee)
    RETURNING id INTO transfer_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_sender, -v_total, 'transfer_out', transfer_id,
    jsonb_build_object('target_uid', target_clean, 'fee', v_fee, 'mining_part', v_mining_used));

  PERFORM public.credit_bonus_balance(r_id, _amount, 'transfer_in', transfer_id, jsonb_build_object('sender_id', _sender));

  RETURN jsonb_build_object('ok', true, 'transfer_id', transfer_id,
    'receiver_name', coalesce(r_display, 'ইউজার'), 'amount', _amount, 'fee', v_fee);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_recharge_request(uuid, text, text, text, numeric) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.send_balance_transfer(uuid, text, numeric, text) FROM anon, authenticated;