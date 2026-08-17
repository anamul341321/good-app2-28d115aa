ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS locked_mined numeric NOT NULL DEFAULT 0;
ALTER TABLE public.mining_state ADD COLUMN IF NOT EXISTS mining_unlocked numeric NOT NULL DEFAULT 0;

-- 1) settle_mining: per-slot mining (no 10-slot gate) + per-slot locked accrual
CREATE OR REPLACE FUNCTION public.settle_mining(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  valid_count int;
  new_self_slots int;
  new_ref_units numeric;
  qual_ref int;
  elapsed_sec numeric;
  rate_per_slot_sec numeric := 500.0 / (30.0 * 24.0 * 3600.0) / 10.0;
  prev_self_rate numeric;
  prev_ref_rate numeric;
  self_delta numeric := 0;
  ref_delta numeric := 0;
  parent_id uuid;
  auto_qualified boolean;
  new_active boolean;
  fv_mode boolean;
  status_filter public.task_status[];
BEGIN
  SELECT coalesce(first_verify_mining_mode, false) INTO fv_mode
    FROM public.bonus_settings WHERE id = 'default';

  IF fv_mode THEN
    status_filter := ARRAY['done','verified']::public.task_status[];
  ELSE
    status_filter := ARRAY['done']::public.task_status[];
  END IF;

  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO valid_count
    FROM public.tasks
   WHERE user_id = _user_id
     AND status = ANY(status_filter)
     AND coalesce(whitelist_ok, true) = true
     AND wallet_address IS NOT NULL;

  -- Every re-verified (and whitelisted) slot mines on its own — 1 slot is enough.
  SELECT count(DISTINCT slot)::integer INTO new_self_slots
    FROM public.tasks
   WHERE user_id = _user_id
     AND coalesce(whitelist_ok, true) = true
     AND wallet_address IS NOT NULL
     AND (coalesce(reverify_count, 0) > 0
          OR (fv_mode AND status = ANY(status_filter)));

  auto_qualified := coalesce(new_self_slots, 0) > 0;

  SELECT coalesce(count(*), 0)::int,
         coalesce(sum(greatest(ms.self_slots, 0)) * 0.1, 0)
    INTO qual_ref, new_ref_units
    FROM public.profiles p
    JOIN public.mining_state ms ON ms.user_id = p.id
   WHERE p.referred_by = _user_id
     AND coalesce(ms.self_slots, 0) > 0;

  new_active := coalesce(m.admin_forced_active, false)
                OR coalesce(new_self_slots, 0) > 0
                OR coalesce(new_ref_units, 0) > 0;

  IF m.is_active AND m.last_credited_at IS NOT NULL THEN
    elapsed_sec := greatest(EXTRACT(EPOCH FROM (now() - m.last_credited_at)), 0);
    IF coalesce(m.self_qualified, false) OR coalesce(m.admin_forced_active, false) THEN
      prev_self_rate := rate_per_slot_sec * coalesce(m.self_slots, 0)::numeric;
    ELSE
      prev_self_rate := 0;
    END IF;
    prev_ref_rate := rate_per_slot_sec * coalesce(m.referral_units, 0);
    self_delta := elapsed_sec * prev_self_rate;
    ref_delta := elapsed_sec * prev_ref_rate;
  END IF;

  PERFORM set_config('app.balance_change_source', 'mining_settlement', true);

  UPDATE public.mining_state
     SET accrued_amount = coalesce(accrued_amount, 0) + self_delta + ref_delta,
         self_mining_accrued = coalesce(self_mining_accrued, 0) + self_delta,
         referral_accrued = coalesce(referral_accrued, 0) + ref_delta,
         -- referral commission is not tied to a slot → immediately usable
         mining_unlocked = coalesce(mining_unlocked, 0) + ref_delta,
         last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
         effective_task_count = valid_count,
         self_slots = coalesce(new_self_slots, 0),
         referral_units = coalesce(new_ref_units, 0),
         qualifying_referees = coalesce(qual_ref, 0),
         self_qualified = auto_qualified,
         is_active = new_active,
         activated_at = CASE WHEN activated_at IS NULL AND new_active THEN now() ELSE activated_at END
   WHERE user_id = _user_id;

  -- Self mining accrues per slot and stays LOCKED until that slot is re-verified.
  IF self_delta > 0 AND coalesce(m.self_slots, 0) > 0 THEN
    UPDATE public.tasks
       SET locked_mined = coalesce(locked_mined, 0) + (self_delta / coalesce(m.self_slots, 1))
     WHERE user_id = _user_id
       AND coalesce(whitelist_ok, true) = true
       AND wallet_address IS NOT NULL
       AND (coalesce(reverify_count, 0) > 0
            OR (fv_mode AND status = ANY(status_filter)));
  END IF;

  IF self_delta > 0 THEN
    INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
    VALUES (_user_id, self_delta, 'mining', jsonb_build_object('slots', new_self_slots, 'sec', elapsed_sec));
  END IF;
  IF ref_delta > 0 THEN
    INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
    VALUES (_user_id, ref_delta, 'referral', jsonb_build_object('units', new_ref_units, 'sec', elapsed_sec));
  END IF;

  SELECT referred_by INTO parent_id FROM public.profiles WHERE id = _user_id;
  IF parent_id IS NOT NULL AND parent_id <> _user_id THEN
    PERFORM public.settle_mining(parent_id);
  END IF;
END;
$function$;

-- 2) breakdown now reports locked vs available mining
CREATE OR REPLACE FUNCTION public.get_user_balance_breakdown(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m public.mining_state%ROWTYPE;
  v_bal numeric := 0;
  v_bonus numeric := 0;
  v_withdrawn numeric := 0;
  v_mining_withdrawn numeric := 0;
  v_main_withdrawn numeric := 0;
  v_main numeric := 0;
  v_mining numeric := 0;
  v_avail numeric := 0;
BEGIN
  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN '{"total_accrued":0,"withdrawn_total":0,"bonus_part":0,"mining_part":0,"mining_available":0,"mining_locked":0,"available_now":0,"current_balance":0,"total_spent":0}'::jsonb;
  END IF;

  v_withdrawn := greatest(coalesce(m.withdrawn_amount, 0), 0);
  v_bonus := greatest(coalesce(m.bonus_amount, 0), 0);
  v_mining_withdrawn := least(greatest(coalesce(m.mining_withdrawn, 0), 0), v_withdrawn);
  v_bal := greatest(coalesce(m.accrued_amount, 0) - v_withdrawn, 0);

  v_main_withdrawn := greatest(v_withdrawn - v_mining_withdrawn, 0);
  v_main := greatest(least(v_bal, v_bonus - v_main_withdrawn), 0);
  v_mining := greatest(v_bal - v_main, 0);
  v_avail := least(greatest(coalesce(m.mining_unlocked, 0), 0), v_mining);

  RETURN jsonb_build_object(
    'total_accrued', coalesce(m.accrued_amount, 0),
    'withdrawn_total', v_withdrawn,
    'bonus_part', v_main,
    'mining_part', v_mining,
    'mining_available', v_avail,
    'mining_locked', greatest(v_mining - v_avail, 0),
    'available_now', v_main + v_avail,
    'current_balance', v_bal,
    'total_spent', v_withdrawn
  );
END;
$function$;

-- 3) re-verify: unlock that slot's mining + 10৳ repeat-cycle bonus
CREATE OR REPLACE FUNCTION public.transition_task_whitelist(_task_id uuid, _is_whitelisted boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.tasks%ROWTYPE;
  now_at timestamptz := now();
  v_unlock numeric := 0;
  v_bonus_on boolean := true;
BEGIN
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'missing'; END IF;

  IF t.wallet_address IS NULL OR t.status = 'empty'::public.task_status THEN
    RETURN 'skipped_empty';
  END IF;

  IF NOT _is_whitelisted THEN
    IF t.status <> 'verified'::public.task_status OR coalesce(t.whitelist_ok, true) <> false THEN
      UPDATE public.tasks
      SET whitelist_ok = false,
          last_whitelist_check_at = now_at,
          status = 'verified'::public.task_status,
          reverify_due_at = now_at
      WHERE id = _task_id;
      RETURN 'lost';
    END IF;

    UPDATE public.tasks SET last_whitelist_check_at = now_at WHERE id = _task_id;
    RETURN 'unchanged';
  END IF;

  IF coalesce(t.whitelist_ok, true) = false THEN
    v_unlock := greatest(coalesce(t.locked_mined, 0), 0);

    UPDATE public.tasks
    SET whitelist_ok = true,
        last_whitelist_check_at = now_at,
        status = 'done'::public.task_status,
        done_at = now_at,
        last_reverified_at = now_at,
        reverify_count = coalesce(reverify_count, 0) + 1,
        locked_mined = 0
    WHERE id = _task_id;

    -- this slot's own mining earnings become withdrawable
    IF v_unlock > 0 THEN
      UPDATE public.mining_state
         SET mining_unlocked = coalesce(mining_unlocked, 0) + v_unlock
       WHERE user_id = t.user_id;
    END IF;

    -- repeat re-verify (slot was already re-verified before) → 10৳ main balance bonus
    SELECT coalesce(bonus_enabled, true) INTO v_bonus_on FROM public.bonus_settings WHERE id = 'default';
    IF coalesce(v_bonus_on, true) AND coalesce(t.reverify_count, 0) > 0 THEN
      PERFORM public.credit_bonus_balance(
        t.user_id, 10, 'bonus', t.id,
        jsonb_build_object('reason', 'reverify_cycle', 'slot', t.slot));
    END IF;

    RETURN 'restored';
  END IF;

  UPDATE public.tasks SET last_whitelist_check_at = now_at WHERE id = _task_id;
  RETURN 'unchanged';
END;
$function$;

-- 4) withdraw: no monthly window; only unlocked mining can be used
CREATE OR REPLACE FUNCTION public.create_withdrawal_request_atomic(_user_id uuid, _gross numeric, _payout numeric, _provider wallet_provider, _wallet_number text, _admin_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.bonus_settings%ROWTYPE;
  v_debt numeric := 0;
  v_balance numeric := 0;
  v_id uuid;
  v_breakdown jsonb;
  v_main numeric := 0;
  v_avail_mining numeric := 0;
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
    FROM public.user_debts WHERE user_id = _user_id AND status IN ('active', 'claimed');
  IF v_debt > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'অ্যাকাউন্টে warning/ঋণ আছে');
  END IF;

  v_breakdown := public.get_user_balance_breakdown(_user_id);
  v_balance := (v_breakdown->>'current_balance')::numeric;
  v_main := (v_breakdown->>'bonus_part')::numeric;
  v_avail_mining := (v_breakdown->>'mining_available')::numeric;

  IF v_balance < _gross THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  v_mining_used := greatest(_gross - v_main, 0);
  IF v_mining_used > v_avail_mining THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'মাইনিং ব্যালেন্সের একটি অংশ লক — যে স্লট রি-ভেরিফাই করবেন, সেই স্লটের মাইনিং আনলক হবে। এখন তোলা যাবে: '
      || floor(v_main + v_avail_mining)::text || '৳');
  END IF;

  INSERT INTO public.withdrawals (user_id, amount, provider, wallet_number, status, admin_note)
  VALUES (_user_id, _payout, _provider, _wallet_number, 'pending', _admin_note)
  RETURNING id INTO v_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -_gross, 'withdrawal', v_id,
          jsonb_build_object('gross', _gross, 'payout', _payout, 'fee', _gross - _payout, 'mining_part', v_mining_used));

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount, 0) + _gross,
         mining_withdrawn = coalesce(mining_withdrawn, 0) + v_mining_used,
         mining_unlocked = greatest(coalesce(mining_unlocked, 0) - v_mining_used, 0)
   WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'gross', _gross, 'payout', _payout);
END;
$function$;

-- 5) send balance: no monthly window; only unlocked mining can be used
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
  v_avail_mining numeric := 0;
  v_mining_used numeric := 0;
  s_debt numeric := 0;
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
  v_avail_mining := coalesce((v_break->>'mining_available')::numeric, 0);

  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _sender AND status = 'active';
  v_balance := v_balance - coalesce(s_debt,0);

  IF v_balance < v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  v_mining_used := greatest(v_total - v_main, 0);
  IF v_mining_used > v_avail_mining THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'মাইনিং ব্যালেন্সের একটি অংশ লক — স্লট রি-ভেরিফাই করলে সেই স্লটের মাইনিং আনলক হবে। এখন পাঠানো যাবে: '
      || floor(v_main + v_avail_mining)::text || '৳');
  END IF;

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount,0) + v_total,
         mining_withdrawn = coalesce(mining_withdrawn,0) + v_mining_used,
         mining_unlocked = greatest(coalesce(mining_unlocked,0) - v_mining_used, 0)
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

-- 6) recharge: keep 50৳ / 1-per-day mining rule, add unlocked check
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
  v_avail_mining numeric := 0;
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
  v_avail_mining := coalesce((v_break->>'mining_available')::numeric, 0);

  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _user AND status = 'active';
  v_balance := v_balance - coalesce(s_debt,0);

  IF v_balance < v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  v_mining_used := greatest(v_total - v_main, 0);

  IF v_mining_used > 0 THEN
    IF v_mining_used > v_avail_mining THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'মাইনিং ব্যালেন্সের একটি অংশ লক — স্লট রি-ভেরিফাই করলে সেই স্লটের মাইনিং আনলক হবে');
    END IF;

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
         mining_withdrawn = coalesce(mining_withdrawn,0) + v_mining_used,
         mining_unlocked = greatest(coalesce(mining_unlocked,0) - v_mining_used, 0)
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

-- 7) spread existing mining balance across each user's slots as locked amounts
WITH b AS (
  SELECT ms.user_id,
         greatest(
           greatest(coalesce(ms.accrued_amount,0) - coalesce(ms.withdrawn_amount,0), 0)
           - greatest(least(
               greatest(coalesce(ms.accrued_amount,0) - coalesce(ms.withdrawn_amount,0), 0),
               greatest(coalesce(ms.bonus_amount,0),0)
                 - greatest(coalesce(ms.withdrawn_amount,0) - coalesce(ms.mining_withdrawn,0), 0)
             ), 0),
         0) AS mining_part
    FROM public.mining_state ms
), c AS (
  SELECT b.user_id, b.mining_part, count(t.id) AS slots
    FROM b
    JOIN public.tasks t ON t.user_id = b.user_id AND t.wallet_address IS NOT NULL
   WHERE b.mining_part > 0
   GROUP BY b.user_id, b.mining_part
)
UPDATE public.tasks t
   SET locked_mined = c.mining_part / c.slots
  FROM c
 WHERE t.user_id = c.user_id
   AND t.wallet_address IS NOT NULL;