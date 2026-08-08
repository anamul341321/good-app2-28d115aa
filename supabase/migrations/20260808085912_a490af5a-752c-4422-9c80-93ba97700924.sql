ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS balance_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS balance_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_frozen_reason text;

-- Protect the new admin-only fields from user self-updates.
CREATE OR REPLACE FUNCTION public.enforce_profile_safe_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role'
     OR current_user IN ('postgres','supabase_admin','supabase_read_only_user')
     OR current_user LIKE 'service_role%'
  THEN RETURN NEW; END IF;
  IF OLD.id <> auth.uid() THEN RAISE EXCEPTION 'You can only update your own profile'; END IF;
  IF NEW.banned = true
     AND NEW.banned_reason = 'অস্বাভাবিক duplicate bonus credit — হিসাব ও payment তদন্তের জন্য account সাময়িকভাবে block'
     AND OLD.kyc_verified IS NOT DISTINCT FROM NEW.kyc_verified
     AND OLD.kyc_verified_at IS NOT DISTINCT FROM NEW.kyc_verified_at
     AND OLD.referral_unlock_override IS NOT DISTINCT FROM NEW.referral_unlock_override
     AND OLD.bonus_first_verify_claimed IS NOT DISTINCT FROM NEW.bonus_first_verify_claimed
     AND OLD.bonus_reverify_claimed IS NOT DISTINCT FROM NEW.bonus_reverify_claimed
     AND OLD.bonus_first_verify_self_claimed IS NOT DISTINCT FROM NEW.bonus_first_verify_self_claimed
     AND OLD.balance_frozen IS NOT DISTINCT FROM NEW.balance_frozen
  THEN RETURN NEW; END IF;
  IF OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified OR OLD.kyc_verified_at IS DISTINCT FROM NEW.kyc_verified_at
     OR OLD.banned IS DISTINCT FROM NEW.banned OR OLD.banned_reason IS DISTINCT FROM NEW.banned_reason OR OLD.banned_at IS DISTINCT FROM NEW.banned_at
     OR OLD.referral_unlock_override IS DISTINCT FROM NEW.referral_unlock_override
     OR OLD.bonus_first_verify_claimed IS DISTINCT FROM NEW.bonus_first_verify_claimed
     OR OLD.bonus_reverify_claimed IS DISTINCT FROM NEW.bonus_reverify_claimed
     OR OLD.bonus_first_verify_self_claimed IS DISTINCT FROM NEW.bonus_first_verify_self_claimed
     OR OLD.balance_frozen IS DISTINCT FROM NEW.balance_frozen
     OR OLD.balance_frozen_at IS DISTINCT FROM NEW.balance_frozen_at
     OR OLD.balance_frozen_reason IS DISTINCT FROM NEW.balance_frozen_reason
  THEN RAISE EXCEPTION 'You are not allowed to modify admin-controlled profile fields'; END IF;
  RETURN NEW;
END;
$function$;

-- Bonus is only for the FIRST 10 slots (slot 1..10).
CREATE OR REPLACE FUNCTION public.claim_reverify_bonus(_user_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  unique_slots integer;
  already_claimed boolean;
  award numeric;
  settings public.bonus_settings%ROWTYPE;
  in_promo boolean;
BEGIN
  SELECT bonus_reverify_claimed INTO already_claimed
    FROM public.profiles WHERE id = _user_id FOR UPDATE;

  IF NOT FOUND OR coalesce(already_claimed, false) THEN
    RETURN 0;
  END IF;

  SELECT count(DISTINCT slot)::integer INTO unique_slots
    FROM public.tasks
   WHERE user_id = _user_id
     AND slot <= 10
     AND coalesce(reverify_count, 0) > 0;

  IF coalesce(unique_slots, 0) < 10 THEN
    RETURN 0;
  END IF;

  SELECT * INTO settings FROM public.bonus_settings WHERE id = 'default';

  in_promo := coalesce(settings.promo_active, false)
    AND settings.promo_start_at IS NOT NULL
    AND settings.promo_end_at IS NOT NULL
    AND now() BETWEEN settings.promo_start_at AND settings.promo_end_at;

  award := CASE
    WHEN in_promo AND settings.promo_reverify_bonus IS NOT NULL
      THEN settings.promo_reverify_bonus
    ELSE coalesce(settings.reverify_bonus, 200)
  END;

  INSERT INTO public.mining_state (
    user_id, accrued_amount, bonus_amount, is_active,
    admin_forced_active, activated_at, last_credited_at
  )
  VALUES (
    _user_id, greatest(award, 0), greatest(award, 0), true,
    false, now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET accrued_amount      = coalesce(public.mining_state.accrued_amount, 0) + greatest(award, 0),
      bonus_amount        = coalesce(public.mining_state.bonus_amount, 0) + greatest(award, 0),
      is_active           = true,
      admin_forced_active = false,
      activated_at        = coalesce(public.mining_state.activated_at, now()),
      last_credited_at    = coalesce(public.mining_state.last_credited_at, now());

  UPDATE public.profiles SET bonus_reverify_claimed = true WHERE id = _user_id;

  RETURN greatest(award, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_welcome_bonuses(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.profiles%ROWTYPE;
  s public.bonus_settings%ROWTYPE;
  v_first_count integer := 0;
  v_reverify_count integer := 0;
  self_award numeric := 0;
  ref_award numeric := 0;
  reverify_award numeric := 0;
  in_promo boolean := false;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND OR coalesce(p.banned, false) THEN
    RETURN jsonb_build_object('self_first_amount',0,'referrer_amount',0,'reverify_amount',0);
  END IF;

  -- Bonuses only count the first 10 slots.
  SELECT count(DISTINCT t.slot) FILTER (WHERE t.initial_verify_at IS NOT NULL),
         count(DISTINCT t.slot) FILTER (WHERE coalesce(t.reverify_count,0) > 0 AND coalesce(t.whitelist_ok,true) AND t.wallet_address IS NOT NULL)
    INTO v_first_count, v_reverify_count
    FROM public.tasks t WHERE t.user_id = _user_id AND t.slot <= 10;

  SELECT * INTO s FROM public.bonus_settings WHERE id = 'default';
  in_promo := coalesce(s.promo_active,false)
              AND s.promo_start_at IS NOT NULL AND s.promo_end_at IS NOT NULL
              AND now() BETWEEN s.promo_start_at AND s.promo_end_at;

  IF v_first_count >= 10 AND NOT coalesce(p.bonus_first_verify_self_claimed,false) THEN
    self_award := greatest(CASE WHEN in_promo AND s.promo_first_verify_bonus IS NOT NULL THEN s.promo_first_verify_bonus ELSE coalesce(s.first_verify_bonus,50) END,0);
    UPDATE public.profiles SET bonus_first_verify_self_claimed=true WHERE id=_user_id;
    PERFORM public.credit_bonus_balance(_user_id,self_award);
  END IF;

  IF v_first_count >= 10 AND NOT coalesce(p.bonus_first_verify_claimed,false) THEN
    UPDATE public.profiles SET bonus_first_verify_claimed=true WHERE id=_user_id;
    IF p.referred_by IS NOT NULL AND p.referred_by <> _user_id THEN
      PERFORM 1 FROM public.profiles WHERE id=p.referred_by FOR UPDATE;
      ref_award := greatest(CASE WHEN in_promo AND s.promo_referrer_bonus IS NOT NULL THEN s.promo_referrer_bonus ELSE coalesce(s.referrer_bonus,100) END,0);
      PERFORM public.credit_bonus_balance(p.referred_by,ref_award);
    END IF;
  END IF;

  IF v_reverify_count >= 10 AND NOT coalesce(p.bonus_reverify_claimed,false) THEN
    reverify_award := public.claim_reverify_bonus(_user_id);
  END IF;

  RETURN jsonb_build_object('self_first_amount',self_award,'referrer_amount',ref_award,'reverify_amount',reverify_award);
END;
$function$;

-- Frozen accounts cannot move money.
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

  SELECT (coalesce(accrued_amount,0) - coalesce(withdrawn_amount,0)) INTO s_bal
    FROM public.mining_state WHERE user_id = _sender FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _sender AND status = 'active';
  s_bal := coalesce(s_bal,0) - coalesce(s_debt,0);

  IF s_bal < _amount THEN
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

CREATE OR REPLACE FUNCTION public.create_recharge_request(_user uuid, _mobile text, _operator text, _connection_type text, _amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s_bal numeric; s_debt numeric; rid uuid; mob_clean text; is_banned boolean; is_frozen boolean;
BEGIN
  SELECT banned, coalesce(balance_frozen,false) INTO is_banned, is_frozen FROM public.profiles WHERE id=_user;
  IF coalesce(is_banned,false) THEN RETURN jsonb_build_object('ok',false,'error','আপনার account block করা আছে'); END IF;
  IF coalesce(is_frozen,false) THEN RETURN jsonb_build_object('ok',false,'error','🧊 আপনার ব্যালেন্স আপাতত freeze করা আছে — admin-এর সাথে যোগাযোগ করুন'); END IF;
  IF _amount IS NULL OR _amount < 20 THEN RETURN jsonb_build_object('ok',false,'error','সর্বনিম্ন ২০৳ রিচার্জ করা যাবে'); END IF;
  mob_clean := regexp_replace(coalesce(_mobile,''),'\D','','g');
  IF length(mob_clean) < 11 THEN RETURN jsonb_build_object('ok',false,'error','সঠিক মোবাইল নম্বর দিন'); END IF;
  IF _operator NOT IN ('grameenphone','robi','banglalink','airtel','teletalk') THEN RETURN jsonb_build_object('ok',false,'error','অপারেটর সিলেক্ট করুন'); END IF;
  IF _connection_type NOT IN ('prepaid','postpaid') THEN _connection_type := 'prepaid'; END IF;
  PERFORM public.settle_mining(_user);
  SELECT coalesce(accrued_amount,0)-coalesce(withdrawn_amount,0) INTO s_bal FROM public.mining_state WHERE user_id=_user FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id=_user AND status='active';
  s_bal := coalesce(s_bal,0)-coalesce(s_debt,0);
  IF s_bal < _amount THEN RETURN jsonb_build_object('ok',false,'error','পর্যাপ্ত ব্যালেন্স নেই'); END IF;
  UPDATE public.mining_state SET withdrawn_amount=coalesce(withdrawn_amount,0)+_amount WHERE user_id=_user;
  INSERT INTO public.recharges(user_id,mobile,operator,connection_type,amount,status) VALUES(_user,mob_clean,_operator,_connection_type,_amount,'pending') RETURNING id INTO rid;
  RETURN jsonb_build_object('ok',true,'recharge_id',rid);
END;
$function$;