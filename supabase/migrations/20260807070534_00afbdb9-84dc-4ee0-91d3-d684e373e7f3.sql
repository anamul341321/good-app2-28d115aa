CREATE OR REPLACE FUNCTION public.claim_welcome_bonuses(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  s public.bonus_settings%ROWTYPE;
  first_count integer := 0;
  reverify_count integer := 0;
  self_award numeric := 0;
  ref_award numeric := 0;
  reverify_award numeric := 0;
  in_promo boolean := false;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND OR coalesce(p.banned, false) THEN
    RETURN jsonb_build_object('self_first_amount',0,'referrer_amount',0,'reverify_amount',0);
  END IF;

  SELECT count(DISTINCT slot) FILTER (WHERE initial_verify_at IS NOT NULL),
         count(DISTINCT slot) FILTER (WHERE coalesce(reverify_count,0) > 0 AND coalesce(whitelist_ok,true) AND wallet_address IS NOT NULL)
    INTO first_count, reverify_count
    FROM public.tasks WHERE user_id = _user_id;

  SELECT * INTO s FROM public.bonus_settings WHERE id = 'default';
  in_promo := coalesce(s.promo_active,false)
              AND s.promo_start_at IS NOT NULL AND s.promo_end_at IS NOT NULL
              AND now() BETWEEN s.promo_start_at AND s.promo_end_at;

  IF first_count >= 10 AND NOT coalesce(p.bonus_first_verify_self_claimed,false) THEN
    self_award := greatest(CASE WHEN in_promo AND s.promo_first_verify_bonus IS NOT NULL THEN s.promo_first_verify_bonus ELSE coalesce(s.first_verify_bonus,50) END,0);
    UPDATE public.profiles SET bonus_first_verify_self_claimed=true WHERE id=_user_id;
    PERFORM public.credit_bonus_balance(_user_id,self_award);
  END IF;

  IF first_count >= 10 AND NOT coalesce(p.bonus_first_verify_claimed,false) THEN
    UPDATE public.profiles SET bonus_first_verify_claimed=true WHERE id=_user_id;
    IF p.referred_by IS NOT NULL AND p.referred_by <> _user_id THEN
      PERFORM 1 FROM public.profiles WHERE id=p.referred_by FOR UPDATE;
      ref_award := greatest(CASE WHEN in_promo AND s.promo_referrer_bonus IS NOT NULL THEN s.promo_referrer_bonus ELSE coalesce(s.referrer_bonus,100) END,0);
      PERFORM public.credit_bonus_balance(p.referred_by,ref_award);
    END IF;
  END IF;

  IF reverify_count >= 10 AND NOT coalesce(p.bonus_reverify_claimed,false) THEN
    reverify_award := public.claim_reverify_bonus(_user_id);
  END IF;

  RETURN jsonb_build_object('self_first_amount',self_award,'referrer_amount',ref_award,'reverify_amount',reverify_award);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_welcome_bonuses(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_welcome_bonuses(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_profile_safe_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user = 'supabase_admin' OR current_user LIKE 'service_role%' THEN
    RETURN NEW;
  END IF;
  IF OLD.id <> auth.uid() THEN RAISE EXCEPTION 'You can only update your own profile'; END IF;
  IF OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified
     OR OLD.kyc_verified_at IS DISTINCT FROM NEW.kyc_verified_at
     OR OLD.banned IS DISTINCT FROM NEW.banned
     OR OLD.banned_reason IS DISTINCT FROM NEW.banned_reason
     OR OLD.banned_at IS DISTINCT FROM NEW.banned_at
     OR OLD.referral_unlock_override IS DISTINCT FROM NEW.referral_unlock_override
     OR OLD.bonus_first_verify_claimed IS DISTINCT FROM NEW.bonus_first_verify_claimed
     OR OLD.bonus_reverify_claimed IS DISTINCT FROM NEW.bonus_reverify_claimed
     OR OLD.bonus_first_verify_self_claimed IS DISTINCT FROM NEW.bonus_first_verify_self_claimed
  THEN RAISE EXCEPTION 'You are not allowed to modify admin-controlled profile fields'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_recharge_request(_user uuid, _mobile text, _operator text, _connection_type text, _amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s_bal numeric; s_debt numeric; rid uuid; mob_clean text; is_banned boolean;
BEGIN
  SELECT banned INTO is_banned FROM public.profiles WHERE id=_user;
  IF coalesce(is_banned,false) THEN RETURN jsonb_build_object('ok',false,'error','আপনার account block করা আছে'); END IF;
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
$$;