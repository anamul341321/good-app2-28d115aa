-- 1) Re-verify (300৳) bonus must count re-verifies HISTORICALLY, exactly like
-- first-verify. Losing whitelist afterwards is normal (that is what re-verify
-- is for) and must not retract eligibility for the one-time bonus.
CREATE OR REPLACE FUNCTION public.claim_reverify_bonus(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unique_slots integer;
  already_claimed boolean;
  award numeric;
  settings public.bonus_settings%ROWTYPE;
  in_promo boolean;
BEGIN
  SELECT * INTO settings FROM public.bonus_settings WHERE id = 'default';
  IF coalesce(settings.bonus_enabled, true) = false THEN
    RETURN 0;
  END IF;

  SELECT bonus_reverify_claimed INTO already_claimed
    FROM public.profiles WHERE id = _user_id FOR UPDATE;

  IF NOT FOUND OR coalesce(already_claimed, false) THEN
    RETURN 0;
  END IF;

  -- historical: a slot that has ever been re-verified counts forever
  SELECT count(DISTINCT slot)::integer INTO unique_slots
    FROM public.tasks
   WHERE user_id = _user_id
     AND slot <= 10
     AND wallet_address IS NOT NULL
     AND coalesce(reverify_count, 0) > 0;

  IF coalesce(unique_slots, 0) < 10 THEN
    RETURN 0;
  END IF;

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

  INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
  VALUES (_user_id, greatest(award, 0), 'bonus', '{"reason":"reverify_bonus"}');

  RETURN greatest(award, 0);
END;
$$;

-- claim_welcome_bonuses must use the same historical count
CREATE OR REPLACE FUNCTION public.claim_welcome_bonuses(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT * INTO s FROM public.bonus_settings WHERE id = 'default';
  IF coalesce(s.bonus_enabled, true) = false THEN
    RETURN jsonb_build_object('self_first_amount',0,'referrer_amount',0,'reverify_amount',0,'disabled',true);
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND OR coalesce(p.banned, false) THEN
    RETURN jsonb_build_object('self_first_amount',0,'referrer_amount',0,'reverify_amount',0);
  END IF;

  SELECT count(DISTINCT t.slot) FILTER (WHERE t.initial_verify_at IS NOT NULL AND t.wallet_address IS NOT NULL),
         count(DISTINCT t.slot) FILTER (WHERE coalesce(t.reverify_count,0) > 0 AND t.wallet_address IS NOT NULL)
    INTO v_first_count, v_reverify_count
    FROM public.tasks t WHERE t.user_id = _user_id AND t.slot <= 10;

  in_promo := coalesce(s.promo_active,false)
              AND s.promo_start_at IS NOT NULL AND s.promo_end_at IS NOT NULL
              AND now() BETWEEN s.promo_start_at AND s.promo_end_at;

  IF v_first_count >= 10 AND NOT coalesce(p.bonus_first_verify_self_claimed,false) THEN
    self_award := greatest(CASE WHEN in_promo AND s.promo_first_verify_bonus IS NOT NULL THEN s.promo_first_verify_bonus ELSE coalesce(s.first_verify_bonus,50) END,0);
    UPDATE public.profiles SET bonus_first_verify_self_claimed=true WHERE id=_user_id;
    IF self_award > 0 THEN
      PERFORM public.credit_bonus_balance(_user_id, self_award, 'bonus', NULL, '{"reason":"first_verify_self"}');
    END IF;
  END IF;

  IF v_first_count >= 10 AND p.referrer_bonus_paid_at IS NULL THEN
    UPDATE public.profiles
       SET bonus_first_verify_claimed = true,
           referrer_bonus_paid_at = now()
     WHERE id = _user_id;
    IF p.referred_by IS NOT NULL AND p.referred_by <> _user_id THEN
      PERFORM 1 FROM public.profiles WHERE id=p.referred_by FOR UPDATE;
      ref_award := greatest(CASE WHEN in_promo AND s.promo_referrer_bonus IS NOT NULL THEN s.promo_referrer_bonus ELSE coalesce(s.referrer_bonus,100) END,0);
      IF ref_award > 0 THEN
        PERFORM public.credit_bonus_balance(p.referred_by, ref_award, 'referral_bonus', NULL,
          jsonb_build_object('referee_id', _user_id, 'rate', ref_award, 'paid_at', now()));
      END IF;
    END IF;
  END IF;

  IF v_reverify_count >= 10 AND NOT coalesce(p.bonus_reverify_claimed,false) THEN
    reverify_award := public.claim_reverify_bonus(_user_id);
  END IF;

  RETURN jsonb_build_object('self_first_amount',self_award,'referrer_amount',ref_award,'reverify_amount',reverify_award);
END;
$$;

-- 2) Backfill: pay the one-time re-verify bonus to everyone who already
-- completed 10 re-verified slots but never received it.
DO $$
DECLARE r record; v numeric;
BEGIN
  FOR r IN
    SELECT p.id FROM public.profiles p
     WHERE coalesce(p.bonus_reverify_claimed,false) = false
       AND coalesce(p.banned,false) = false
       AND (SELECT count(DISTINCT t.slot) FROM public.tasks t
             WHERE t.user_id = p.id AND t.slot <= 10
               AND t.wallet_address IS NOT NULL
               AND coalesce(t.reverify_count,0) > 0) >= 10
  LOOP
    v := public.claim_reverify_bonus(r.id);
    IF coalesce(v,0) > 0 THEN
      INSERT INTO public.user_notices (user_id, title, body, metadata)
      VALUES (r.id, '🎉 রি-ভেরিফাই বোনাস যোগ হয়েছে',
        '১০টি ঘরের রি-ভেরিফাই সম্পন্ন হওয়ায় আপনার ' || to_char(v,'FM999999') ||
        '৳ বোনাস মেইন ব্যালেন্সে যোগ করা হয়েছে। এই টাকা যেকোনো সময় উইথড্র করতে পারবেন।',
        jsonb_build_object('severity','success','url','/home'));
    END IF;
  END LOOP;
END $$;

-- 3) Backfill missing 10৳ repeat-re-verify gifts: every re-verify cycle after
-- the first must have exactly one 10৳ gift recorded for that slot.
DO $$
DECLARE r record; v_pending uuid; v_missing int;
BEGIN
  FOR r IN
    SELECT t.id, t.user_id, t.slot,
           (coalesce(t.reverify_count,0) - 1) AS due,
           (SELECT count(*) FROM public.slot_claims sc WHERE sc.task_id = t.id AND coalesce(sc.bonus_amount,0) > 0) AS paid
      FROM public.tasks t
     WHERE coalesce(t.reverify_count,0) >= 2
  LOOP
    v_missing := r.due - r.paid;
    IF v_missing > 0 THEN
      SELECT id INTO v_pending FROM public.slot_claims
       WHERE task_id = r.id AND status = 'pending' AND coalesce(bonus_amount,0) = 0
       ORDER BY created_at LIMIT 1;
      IF v_pending IS NOT NULL THEN
        UPDATE public.slot_claims SET bonus_amount = 10 WHERE id = v_pending;
        v_missing := v_missing - 1;
      END IF;
      WHILE v_missing > 0 LOOP
        INSERT INTO public.slot_claims (user_id, task_id, slot, bonus_amount, mining_amount, status)
        VALUES (r.user_id, r.id, r.slot, 10, 0, 'pending');
        v_missing := v_missing - 1;
      END LOOP;
      INSERT INTO public.user_notices (user_id, title, body, metadata)
      VALUES (r.user_id, '🎁 ১০৳ রি-ভেরিফাই বোনাস যোগ হয়েছে',
        '#' || r.slot || ' নং ঘরের পুনরায় রি-ভেরিফাই বোনাস (১০৳) যোগ করা হয়েছে — হোম পেজে ওই ঘরের নিচে "ক্লেইম" বাটনে চাপ দিলেই মেইন ব্যালেন্সে চলে আসবে।',
        jsonb_build_object('severity','success','url','/home'));
    END IF;
  END LOOP;
END $$;