ALTER TABLE public.mining_state
  ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC NOT NULL DEFAULT 0;

UPDATE public.mining_state
   SET bonus_amount = accrued_amount
 WHERE bonus_amount = 0;

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

  INSERT INTO public.mining_state (user_id, accrued_amount, bonus_amount, is_active, admin_forced_active, activated_at, last_credited_at)
  VALUES (_user_id, greatest(award, 0), greatest(award, 0), true, true, now(), now())
  ON CONFLICT (user_id) DO UPDATE
  SET accrued_amount       = coalesce(public.mining_state.accrued_amount, 0) + greatest(award, 0),
      bonus_amount         = coalesce(public.mining_state.bonus_amount, 0)   + greatest(award, 0),
      is_active            = true,
      admin_forced_active  = true,
      activated_at         = coalesce(public.mining_state.activated_at, now()),
      last_credited_at     = coalesce(public.mining_state.last_credited_at, now());

  UPDATE public.profiles
  SET bonus_reverify_claimed = true
  WHERE id = _user_id;

  RETURN greatest(award, 0);
END;
$function$;

UPDATE public.mining_state m
   SET is_active           = true,
       admin_forced_active = true,
       activated_at        = coalesce(m.activated_at, now()),
       last_credited_at    = coalesce(m.last_credited_at, now())
  FROM public.profiles p
 WHERE p.id = m.user_id
   AND coalesce(p.bonus_reverify_claimed, false) = true
   AND coalesce(m.is_active, false) = false;