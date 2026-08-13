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
BEGIN
  -- Serialize recharge creation per user so concurrent taps cannot bypass the daily limit.
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
  IF s_bal < _amount THEN
    RETURN jsonb_build_object('ok',false,'error','পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  UPDATE public.mining_state
    SET withdrawn_amount=coalesce(withdrawn_amount,0)+_amount
    WHERE user_id=_user;
  INSERT INTO public.recharges(user_id,mobile,operator,connection_type,amount,status)
    VALUES(_user,mob_clean,_operator,_connection_type,_amount,'pending')
    RETURNING id INTO rid;
  RETURN jsonb_build_object('ok',true,'recharge_id',rid);
END;
$function$;

-- Resolve the specifically reported request that was left pending after the server call stopped.
DO $block$
DECLARE
  stuck public.recharges%ROWTYPE;
BEGIN
  SELECT * INTO stuck
  FROM public.recharges
  WHERE id = '5ba7dc97-ee3f-4943-b4c2-292430baa506'::uuid
    AND status = 'pending'
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.recharges
      SET status = 'failed',
          error_message = 'রিচার্জ সম্পন্ন হয়নি — কাটা ব্যালেন্স ফেরত দেওয়া হয়েছে',
          provider_response = jsonb_build_object('reconciled', true, 'reason', 'stale_pending'),
          updated_at = now()
      WHERE id = stuck.id;

    UPDATE public.mining_state
      SET withdrawn_amount = greatest(0, coalesce(withdrawn_amount,0) - stuck.amount)
      WHERE user_id = stuck.user_id;
  END IF;
END;
$block$;