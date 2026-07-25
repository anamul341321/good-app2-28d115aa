CREATE OR REPLACE FUNCTION public.claim_reverify_bonus(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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

  INSERT INTO public.mining_state (user_id, accrued_amount)
  VALUES (_user_id, greatest(award, 0))
  ON CONFLICT (user_id) DO UPDATE
  SET accrued_amount = coalesce(public.mining_state.accrued_amount, 0) + greatest(award, 0);

  UPDATE public.profiles
  SET bonus_reverify_claimed = true
  WHERE id = _user_id;

  RETURN greatest(award, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_reverify_bonus(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_reverify_bonus(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.claim_reverify_bonus(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reverify_bonus(uuid) TO service_role;