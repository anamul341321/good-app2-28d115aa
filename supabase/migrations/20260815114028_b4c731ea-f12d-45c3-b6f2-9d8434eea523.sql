-- 1. Add fee columns to recharges and transfers
ALTER TABLE public.recharges ADD COLUMN IF NOT EXISTS fee_amount numeric DEFAULT 0;
ALTER TABLE public.recharges ADD COLUMN IF NOT EXISTS total_deducted numeric DEFAULT 0;

ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS fee_amount numeric DEFAULT 0;

-- 2. Update create_recharge_request with 10% Fee
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
  is_banned boolean;
  is_frozen boolean;
  today_start timestamptz;
  tomorrow_start timestamptz;
  _fee numeric;
  _total_to_deduct numeric;
BEGIN
  -- 10% Service Fee calculation
  _fee := floor(_amount * 0.1);
  _total_to_deduct := _amount + _fee;

  PERFORM pg_advisory_xact_lock(hashtextextended(_user::text, 918273));

  SELECT banned, coalesce(balance_frozen,false)
    INTO is_banned, is_frozen
    FROM public.profiles
    WHERE id = _user;

  IF coalesce(is_banned,false) THEN
    RETURN jsonb_build_object('ok',false,'error','আপনার account block করা আছে');
  END IF;
  IF coalesce(is_frozen,false) THEN
    RETURN jsonb_build_object('ok',false,'error','🧊 আপনার ব্যালেন্স আপাতত freeze করা আছে — admin-এর সাথে যোগাযোগ করুন');
  END IF;
  IF _amount IS NULL OR _amount < 20 THEN
    RETURN jsonb_build_object('ok',false,'error','সর্বনিম্ন ২০৳ রিচার্জ করা যাবে');
  END IF;
  IF _amount > 50 THEN
    RETURN jsonb_build_object('ok',false,'error','একবারে সর্বোচ্চ ৫০৳ রিচার্জ করা যাবে');
  END IF;

  today_start := (date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka');
  tomorrow_start := today_start + interval '1 day';
  IF EXISTS (
    SELECT 1 FROM public.recharges
    WHERE user_id = _user
      AND created_at >= today_start
      AND created_at < tomorrow_start
  ) THEN
    RETURN jsonb_build_object('ok',false,'error','দিনে শুধু ১টি মোবাইল রিচার্জ করা যাবে — আগামীকাল আবার চেষ্টা করুন');
  END IF;

  mob_clean := regexp_replace(coalesce(_mobile,''),'\D','','g');
  IF length(mob_clean) <> 11 OR mob_clean !~ '^01[3-9][0-9]{8}$' THEN
    RETURN jsonb_build_object('ok',false,'error','সঠিক মোবাইল নম্বর দিন');
  END IF;
  IF _operator NOT IN ('grameenphone','robi','banglalink','airtel','teletalk') THEN
    RETURN jsonb_build_object('ok',false,'error','অপারেটর সিলেক্ট করুন');
  END IF;
  IF _connection_type NOT IN ('prepaid','postpaid') THEN
    _connection_type := 'prepaid';
  END IF;

  PERFORM public.settle_mining(_user);
  SELECT coalesce(accrued_amount,0)-coalesce(withdrawn_amount,0)
    INTO s_bal FROM public.mining_state WHERE user_id=_user FOR UPDATE;
  SELECT coalesce(sum(amount),0)
    INTO s_debt FROM public.user_debts WHERE user_id=_user AND status='active';
  s_bal := coalesce(s_bal,0)-coalesce(s_debt,0);

  IF s_bal < _total_to_deduct THEN
    RETURN jsonb_build_object('ok',false,'error','Insufficient balance. Total cost: ৳' || _total_to_deduct::text);
  END IF;

  UPDATE public.mining_state
    SET withdrawn_amount=coalesce(withdrawn_amount,0)+_total_to_deduct
    WHERE user_id=_user;
    
  INSERT INTO public.recharges(user_id,mobile,operator,connection_type,amount,fee_amount,total_deducted,status)
    VALUES(_user,mob_clean,_operator,_connection_type,_amount,_fee,_total_to_deduct,'pending')
    RETURNING id INTO rid;
    
  RETURN jsonb_build_object('ok',true,'recharge_id',rid,'fee',_fee,'total',_total_to_deduct);
END;
$function$;

-- 3. Update mark_recharge_result with Refund Logic (Amount + Fee)
CREATE OR REPLACE FUNCTION public.mark_recharge_result(
  _recharge_id uuid,
  _status text,
  _provider_ref text,
  _provider_response jsonb,
  _error text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.recharges%ROWTYPE;
  _refund_amount numeric;
BEGIN
  SELECT * INTO r FROM public.recharges WHERE id = _recharge_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF r.status <> 'pending' THEN RETURN; END IF;

  UPDATE public.recharges
    SET status = _status,
        provider_ref = _provider_ref,
        provider_response = _provider_response,
        error_message = _error,
        updated_at = now()
    WHERE id = _recharge_id;

  IF _status = 'failed' THEN
    _refund_amount := coalesce(r.total_deducted, r.amount);
    UPDATE public.mining_state
      SET withdrawn_amount = greatest(0, coalesce(withdrawn_amount,0) - _refund_amount)
      WHERE user_id = r.user_id;
  END IF;
END;
$$;

-- 4. Update send_balance_transfer with 10% Fee
CREATE OR REPLACE FUNCTION public.send_balance_transfer(_sender uuid, _target text, _amount numeric, _note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_id uuid;
  s_bal numeric;
  s_debt numeric;
  target_clean text;
  transfer_id uuid;
  r_display text;
  s_frozen boolean;
  ms record;
  bonus_total numeric;
  bonus_avail numeric;
  main_withdrawn numeric;
  dhaka_day integer;
  window_open boolean;
  sendable numeric;
  from_main numeric;
  from_mining numeric;
  _fee numeric;
  _total_to_deduct numeric;
BEGIN
  _fee := floor(_amount * 0.1);
  _total_to_deduct := _amount + _fee;

  IF _amount IS NULL OR _amount < 15 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সর্বনিম্ন ১৫৳ পাঠানো যাবে');
  END IF;

  SELECT coalesce(balance_frozen,false) INTO s_frozen FROM public.profiles WHERE id = _sender;
  IF coalesce(s_frozen,false) THEN
    RETURN jsonb_build_object('ok', false, 'error', '🧊 আপনার ব্যালেন্স আপাতত freeze করা আছে — admin-এর সাথে যোগাযোগ করুন');
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

  SELECT * INTO ms FROM public.mining_state WHERE user_id = _sender FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ব্যালেন্স পাওয়া যায়নি');
  END IF;

  s_bal := coalesce(ms.accrued_amount,0) - coalesce(ms.withdrawn_amount,0);
  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _sender AND status = 'active';
  s_bal := coalesce(s_bal,0) - coalesce(s_debt,0);

  bonus_total := coalesce(ms.bonus_amount,0);
  main_withdrawn := greatest(coalesce(ms.withdrawn_amount,0) - least(coalesce(ms.mining_withdrawn,0), coalesce(ms.withdrawn_amount,0)), 0);
  bonus_avail := greatest(bonus_total - main_withdrawn - coalesce(s_debt,0), 0);
  bonus_avail := least(bonus_avail, greatest(s_bal, 0));
  dhaka_day := extract(day from (now() AT TIME ZONE 'Asia/Dhaka'))::int;
  window_open := dhaka_day <= 3;

  sendable := least(s_bal, CASE WHEN window_open THEN s_bal ELSE bonus_avail END);

  IF _total_to_deduct > sendable THEN
    IF NOT window_open AND _total_to_deduct <= s_bal THEN
      RETURN jsonb_build_object('ok', false, 'error',
        '⛏️ মাইনিং ব্যালেন্স এখন লক — প্রতি মাসের ১–৩ তারিখেই শুধু পাঠানো বা withdraw করা যাবে। এখন শুধু মেইন ব্যালেন্স (' || floor(bonus_avail)::text || '৳) পাঠাতে পারবেন। ফী সহ মোট ৳' || _total_to_deduct::text || ' প্রয়োজন।');
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient balance. Need ৳' || _total_to_deduct::text || ' (including 10% fee).');
  END IF;

  from_main := least(_total_to_deduct, bonus_avail);
  from_mining := _total_to_deduct - from_main;

  UPDATE public.mining_state
    SET withdrawn_amount = coalesce(withdrawn_amount,0) + _total_to_deduct,
        mining_withdrawn = coalesce(mining_withdrawn,0) + from_mining
    WHERE user_id = _sender;

  PERFORM public.credit_bonus_balance(r_id, _amount);

  INSERT INTO public.transfers (sender_id, receiver_id, amount, fee_amount, note)
    VALUES (_sender, r_id, _amount, _fee, nullif(trim(coalesce(_note,'')), ''))
    RETURNING id INTO transfer_id;

  RETURN jsonb_build_object('ok', true, 'transfer_id', transfer_id, 'receiver_name', r_display, 'amount', _amount, 'fee', _fee, 'total', _total_to_deduct);
END;
$$;
