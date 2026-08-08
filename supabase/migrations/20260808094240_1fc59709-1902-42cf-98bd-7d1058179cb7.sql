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
  s_frozen boolean;
  ms record;
  bonus_total numeric;
  bonus_avail numeric;
  dhaka_day integer;
  window_open boolean;
  sendable numeric;
BEGIN
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

  -- Mining balance is locked outside the monthly window (1st-3rd, Asia/Dhaka).
  -- Only bonus balance can be sent while locked.
  bonus_total := coalesce(ms.bonus_amount,0);
  bonus_avail := greatest(bonus_total - least(coalesce(ms.withdrawn_amount,0), bonus_total) - coalesce(s_debt,0), 0);
  dhaka_day := extract(day from (now() AT TIME ZONE 'Asia/Dhaka'))::int;
  window_open := dhaka_day <= 3;

  sendable := least(s_bal, CASE WHEN window_open THEN s_bal ELSE bonus_avail END);

  IF _amount > sendable THEN
    IF NOT window_open AND _amount <= s_bal THEN
      RETURN jsonb_build_object('ok', false, 'error',
        '⛏️ মাইনিং ব্যালেন্স এখন লক — প্রতি মাসের ১–৩ তারিখেই শুধু পাঠানো বা withdraw করা যাবে। এখন শুধু বোনাস (' || floor(bonus_avail)::text || '৳) পাঠাতে পারবেন।');
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  UPDATE public.mining_state SET withdrawn_amount = coalesce(withdrawn_amount,0) + _amount WHERE user_id = _sender;

  PERFORM public.credit_bonus_balance(r_id, _amount);

  INSERT INTO public.transfers (sender_id, receiver_id, amount, note)
    VALUES (_sender, r_id, _amount, nullif(trim(coalesce(_note,'')), ''))
    RETURNING id INTO transfer_id;

  RETURN jsonb_build_object('ok', true, 'transfer_id', transfer_id,
    'receiver_name', coalesce(r_display, 'ইউজার'), 'amount', _amount);
END;
$function$;