-- Create balance ledger table
CREATE TABLE IF NOT EXISTS public.balance_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    type text NOT NULL, -- 'bonus', 'mining', 'referral', 'transfer_in', 'transfer_out', 'withdrawal', 'recharge', 'adjustment'
    source_id uuid, -- ID of the related record (e.g. withdrawal_id, transfer_id)
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Grant access
GRANT SELECT ON public.balance_ledger TO authenticated;
GRANT ALL ON public.balance_ledger TO service_role;

-- RLS
ALTER TABLE public.balance_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own ledger" ON public.balance_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 1. Update credit_bonus_balance to log to ledger
CREATE OR REPLACE FUNCTION public.credit_bonus_balance(_user_id uuid, _amount numeric, _type text DEFAULT 'bonus', _source_id uuid DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;

  INSERT INTO public.mining_state (user_id, accrued_amount, bonus_amount)
  VALUES (_user_id, _amount, _amount)
  ON CONFLICT (user_id) DO UPDATE
  SET accrued_amount = coalesce(public.mining_state.accrued_amount, 0) + _amount,
      bonus_amount   = coalesce(public.mining_state.bonus_amount, 0) + _amount;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, _amount, _type, _source_id, _metadata);
END;
$$;

-- 2. Update settle_mining to log to ledger
CREATE OR REPLACE FUNCTION public.settle_mining(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  valid_count int;
  reverified_count int;
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
  SELECT coalesce(first_verify_mining_mode, false)
    INTO fv_mode
    FROM public.bonus_settings
   WHERE id = 'default';

  IF fv_mode THEN
    status_filter := ARRAY['done','verified']::public.task_status[];
  ELSE
    status_filter := ARRAY['done']::public.task_status[];
  END IF;

  SELECT * INTO m
    FROM public.mining_state
   WHERE user_id = _user_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO valid_count
    FROM public.tasks
   WHERE user_id = _user_id
     AND status = ANY(status_filter)
     AND coalesce(whitelist_ok, true) = true
     AND wallet_address IS NOT NULL;

  SELECT count(DISTINCT slot)::integer INTO reverified_count
    FROM public.tasks
   WHERE user_id = _user_id
     AND coalesce(reverify_count, 0) > 0
     AND coalesce(whitelist_ok, true) = true
     AND wallet_address IS NOT NULL;

  auto_qualified := coalesce(reverified_count, 0) >= 10
                    OR (fv_mode AND valid_count >= 10);

  IF auto_qualified THEN
    new_self_slots := CASE WHEN fv_mode
      THEN greatest(coalesce(valid_count,0), coalesce(reverified_count,0))
      ELSE coalesce(reverified_count,0) END;
  ELSE
    new_self_slots := 0;
  END IF;

  SELECT coalesce(count(*), 0)::int,
         coalesce(sum(greatest(ms.self_slots, 0)) * 0.1, 0)
    INTO qual_ref, new_ref_units
    FROM public.profiles p
    JOIN public.mining_state ms ON ms.user_id = p.id
   WHERE p.referred_by = _user_id
     AND coalesce(ms.self_slots, 0) > 0;

  new_active := coalesce(m.admin_forced_active, false)
                OR new_self_slots > 0
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
         last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
         effective_task_count = valid_count,
         self_slots = new_self_slots,
         referral_units = coalesce(new_ref_units, 0),
         qualifying_referees = coalesce(qual_ref, 0),
         self_qualified = auto_qualified,
         is_active = new_active,
         activated_at = CASE WHEN activated_at IS NULL AND new_active THEN now() ELSE activated_at END
   WHERE user_id = _user_id;

  -- Log to ledger
  IF self_delta > 0 THEN
    INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
    VALUES (_user_id, self_delta, 'mining', jsonb_build_object('slots', new_self_slots, 'sec', elapsed_sec));
  END IF;
  IF ref_delta > 0 THEN
    INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
    VALUES (_user_id, ref_delta, 'referral', jsonb_build_object('units', new_ref_units, 'sec', elapsed_sec));
  END IF;

  SELECT referred_by INTO parent_id
    FROM public.profiles
   WHERE id = _user_id;
  IF parent_id IS NOT NULL AND parent_id <> _user_id THEN
    PERFORM public.settle_mining(parent_id);
  END IF;
END;
$function$;

-- 3. Stricter eligibility in claim_welcome_bonuses
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
  SELECT * INTO s FROM public.bonus_settings WHERE id = 'default';
  IF coalesce(s.bonus_enabled, true) = false THEN
    RETURN jsonb_build_object('self_first_amount',0,'referrer_amount',0,'reverify_amount',0,'disabled',true);
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND OR coalesce(p.banned, false) THEN
    RETURN jsonb_build_object('self_first_amount',0,'referrer_amount',0,'reverify_amount',0);
  END IF;

  -- ENFORCE ELIGIBILITY: only count slots that are 'done' AND 'whitelisted'
  SELECT count(DISTINCT t.slot) FILTER (WHERE t.status = 'done' AND coalesce(t.whitelist_ok, true) = true AND t.initial_verify_at IS NOT NULL),
         count(DISTINCT t.slot) FILTER (WHERE coalesce(t.reverify_count,0) > 0 AND coalesce(t.whitelist_ok,true) AND t.wallet_address IS NOT NULL)
    INTO v_first_count, v_reverify_count
    FROM public.tasks t WHERE t.user_id = _user_id AND t.slot <= 10;

  in_promo := coalesce(s.promo_active,false)
              AND s.promo_start_at IS NOT NULL AND s.promo_end_at IS NOT NULL
              AND now() BETWEEN s.promo_start_at AND s.promo_end_at;

  IF v_first_count >= 10 AND NOT coalesce(p.bonus_first_verify_self_claimed,false) THEN
    self_award := greatest(CASE WHEN in_promo AND s.promo_first_verify_bonus IS NOT NULL THEN s.promo_first_verify_bonus ELSE coalesce(s.first_verify_bonus,50) END,0);
    UPDATE public.profiles SET bonus_first_verify_self_claimed=true WHERE id=_user_id;
    PERFORM public.credit_bonus_balance(_user_id, self_award, 'bonus', NULL, '{"reason":"first_verify_self"}');
  END IF;

  IF v_first_count >= 10 AND p.referrer_bonus_paid_at IS NULL THEN
    UPDATE public.profiles
       SET bonus_first_verify_claimed = true,
           referrer_bonus_paid_at = now()
     WHERE id = _user_id;
    IF p.referred_by IS NOT NULL AND p.referred_by <> _user_id THEN
      PERFORM 1 FROM public.profiles WHERE id=p.referred_by FOR UPDATE;
      ref_award := greatest(CASE WHEN in_promo AND s.promo_referrer_bonus IS NOT NULL THEN s.promo_referrer_bonus ELSE coalesce(s.referrer_bonus,100) END,0);
      PERFORM public.credit_bonus_balance(p.referred_by, ref_award, 'referral_bonus', NULL, jsonb_build_object('referee_id', _user_id));
    END IF;
  END IF;

  IF v_reverify_count >= 10 AND NOT coalesce(p.bonus_reverify_claimed,false) THEN
    reverify_award := public.claim_reverify_bonus(_user_id);
  END IF;

  RETURN jsonb_build_object('self_first_amount',self_award,'referrer_amount',ref_award,'reverify_amount',reverify_award);
END;
$function$;

-- 4. Update claim_reverify_bonus to log to ledger
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
  SELECT * INTO settings FROM public.bonus_settings WHERE id = 'default';
  IF coalesce(settings.bonus_enabled, true) = false THEN
    RETURN 0;
  END IF;

  SELECT bonus_reverify_claimed INTO already_claimed
    FROM public.profiles WHERE id = _user_id FOR UPDATE;

  IF NOT FOUND OR coalesce(already_claimed, false) THEN
    RETURN 0;
  END IF;

  -- ENFORCE ELIGIBILITY: only count slots that are 'done' AND 'whitelisted'
  SELECT count(DISTINCT slot)::integer INTO unique_slots
    FROM public.tasks
   WHERE user_id = _user_id
     AND slot <= 10
     AND status = 'done'
     AND coalesce(whitelist_ok, true) = true
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

  -- Log to ledger
  INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
  VALUES (_user_id, greatest(award, 0), 'bonus', '{"reason":"reverify_bonus"}');

  RETURN greatest(award, 0);
END;
$function$;

-- 5. Add balance breakdown RPC
CREATE OR REPLACE FUNCTION public.get_user_balance_breakdown(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_accrued', sum(amount) FILTER (WHERE amount > 0),
    'total_withdrawn', abs(sum(amount) FILTER (WHERE amount < 0 AND type = 'withdrawal')),
    'bonus', sum(amount) FILTER (WHERE type = 'bonus' OR type = 'referral_bonus'),
    'mining', sum(amount) FILTER (WHERE type = 'mining'),
    'referral', sum(amount) FILTER (WHERE type = 'referral'),
    'transfer_in', sum(amount) FILTER (WHERE type = 'transfer_in'),
    'transfer_out', abs(sum(amount) FILTER (WHERE type = 'transfer_out')),
    'recharge', abs(sum(amount) FILTER (WHERE type = 'recharge')),
    'adjustment', sum(amount) FILTER (WHERE type = 'adjustment')
  ) INTO res
  FROM public.balance_ledger
  WHERE user_id = _user_id;

  RETURN coalesce(res, '{}'::jsonb);
END;
$$;
