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
  SELECT bonus_reverify_claimed
    INTO already_claimed
    FROM public.profiles
   WHERE id = _user_id
   FOR UPDATE;

  IF NOT FOUND OR coalesce(already_claimed, false) THEN
    RETURN 0;
  END IF;

  SELECT count(DISTINCT slot)::integer
    INTO unique_slots
    FROM public.tasks
   WHERE user_id = _user_id
     AND coalesce(reverify_count, 0) > 0;

  IF coalesce(unique_slots, 0) < 10 THEN
    RETURN 0;
  END IF;

  SELECT * INTO settings
    FROM public.bonus_settings
   WHERE id = 'default';

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

  UPDATE public.profiles
     SET bonus_reverify_claimed = true
   WHERE id = _user_id;

  RETURN greatest(award, 0);
END;
$function$;

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
  qual_ref int;
  elapsed_sec numeric;
  rate_per_sec numeric := 500.0 / (30.0 * 24.0 * 3600.0);
  prev_rate numeric;
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
     AND coalesce(reverify_count, 0) > 0;

  SELECT count(*) INTO qual_ref
    FROM public.profiles p
   WHERE p.referred_by = _user_id
     AND (SELECT count(*) FROM public.tasks t
           WHERE t.user_id = p.id
             AND t.status = ANY(status_filter)
             AND coalesce(t.whitelist_ok, true) = true
             AND t.wallet_address IS NOT NULL) >= 10;

  auto_qualified := coalesce(reverified_count, 0) >= 10
                    OR (fv_mode AND valid_count >= 10);
  new_active := coalesce(m.admin_forced_active, false) OR auto_qualified;

  IF m.is_active AND m.last_credited_at IS NOT NULL THEN
    elapsed_sec := greatest(EXTRACT(EPOCH FROM (now() - m.last_credited_at)), 0);
    prev_rate := rate_per_sec * (coalesce(m.effective_task_count,0)::numeric / 10.0)
               + rate_per_sec * 0.10 * coalesce(m.qualifying_referees, 0);
    UPDATE public.mining_state
       SET accrued_amount = accrued_amount + elapsed_sec * prev_rate,
           last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
           effective_task_count = valid_count,
           qualifying_referees = qual_ref,
           is_active = new_active,
           activated_at = CASE WHEN activated_at IS NULL AND auto_qualified THEN now() ELSE activated_at END
     WHERE user_id = _user_id;
  ELSE
    UPDATE public.mining_state
       SET effective_task_count = valid_count,
           qualifying_referees = qual_ref,
           is_active = new_active,
           last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
           activated_at = CASE WHEN activated_at IS NULL AND auto_qualified THEN now() ELSE activated_at END
     WHERE user_id = _user_id;
  END IF;

  SELECT referred_by INTO parent_id
    FROM public.profiles
   WHERE id = _user_id;
  IF parent_id IS NOT NULL AND parent_id <> _user_id THEN
    PERFORM public.settle_mining(parent_id);
  END IF;
END;
$function$;

WITH qualified AS (
  SELECT user_id
    FROM public.tasks
   WHERE coalesce(reverify_count, 0) > 0
   GROUP BY user_id
  HAVING count(DISTINCT slot) >= 10
)
UPDATE public.mining_state m
   SET is_active = true,
       admin_forced_active = false,
       activated_at = coalesce(m.activated_at, now()),
       last_credited_at = coalesce(m.last_credited_at, now())
  FROM qualified q
 WHERE q.user_id = m.user_id;

DO $function$
DECLARE
  qualified_user uuid;
BEGIN
  FOR qualified_user IN
    SELECT user_id
      FROM public.tasks
     WHERE coalesce(reverify_count, 0) > 0
     GROUP BY user_id
    HAVING count(DISTINCT slot) >= 10
  LOOP
    PERFORM public.settle_mining(qualified_user);
  END LOOP;
END;
$function$;