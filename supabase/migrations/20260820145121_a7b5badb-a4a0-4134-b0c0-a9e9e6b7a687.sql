-- Track exactly when bonuses were last switched ON, so re-enabling never pays
-- people who completed their 10 re-verifies while bonuses were OFF.
ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS bonus_enabled_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_bonus_enabled_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.bonus_enabled, false) = true
     AND coalesce(OLD.bonus_enabled, false) = false THEN
    NEW.bonus_enabled_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_bonus_enabled_at ON public.bonus_settings;
CREATE TRIGGER trg_stamp_bonus_enabled_at
  BEFORE UPDATE ON public.bonus_settings
  FOR EACH ROW EXECUTE FUNCTION public.stamp_bonus_enabled_at();

-- Re-verify (one-time) bonus: blocked while bonuses are OFF, and after turning
-- ON only users whose 10th re-verify happens at/after that moment qualify.
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
  tenth_at timestamptz;
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

  SELECT count(DISTINCT slot)::integer INTO unique_slots
    FROM public.tasks
   WHERE user_id = _user_id AND slot <= 10
     AND wallet_address IS NOT NULL
     AND coalesce(reverify_count, 0) > 0;

  IF coalesce(unique_slots, 0) < 10 THEN
    RETURN 0;
  END IF;

  -- when did the 10th qualifying re-verify happen?
  SELECT max(x.at) INTO tenth_at FROM (
    SELECT coalesce(t.last_reverified_at, t.done_at, t.created_at) AS at,
           row_number() OVER (ORDER BY coalesce(t.last_reverified_at, t.done_at, t.created_at)) AS rn
      FROM public.tasks t
     WHERE t.user_id = _user_id AND t.slot <= 10
       AND t.wallet_address IS NOT NULL
       AND coalesce(t.reverify_count, 0) > 0
  ) x WHERE x.rn <= 10;

  IF settings.bonus_enabled_at IS NOT NULL
     AND (tenth_at IS NULL OR tenth_at < settings.bonus_enabled_at) THEN
    RETURN 0;
  END IF;

  in_promo := coalesce(settings.promo_active, false)
    AND settings.promo_start_at IS NOT NULL AND settings.promo_end_at IS NOT NULL
    AND now() BETWEEN settings.promo_start_at AND settings.promo_end_at;

  award := CASE
    WHEN in_promo AND settings.promo_reverify_bonus IS NOT NULL THEN settings.promo_reverify_bonus
    ELSE coalesce(settings.reverify_bonus, 200)
  END;

  INSERT INTO public.mining_state (
    user_id, accrued_amount, bonus_amount, is_active,
    admin_forced_active, activated_at, last_credited_at
  )
  VALUES (_user_id, greatest(award,0), greatest(award,0), true, false, now(), now())
  ON CONFLICT (user_id) DO UPDATE
  SET accrued_amount      = coalesce(public.mining_state.accrued_amount, 0) + greatest(award, 0),
      bonus_amount        = coalesce(public.mining_state.bonus_amount, 0) + greatest(award, 0),
      is_active           = true,
      admin_forced_active = false,
      activated_at        = coalesce(public.mining_state.activated_at, now()),
      last_credited_at    = coalesce(public.mining_state.last_credited_at, now());

  UPDATE public.profiles SET bonus_reverify_claimed = true WHERE id = _user_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
  VALUES (_user_id, greatest(award,0), 'bonus', '{"reason":"reverify_bonus"}');

  RETURN greatest(award, 0);
END;
$$;

-- Stamp the current OFF state so a future ON is what counts.
UPDATE public.bonus_settings SET bonus_enabled_at = NULL
 WHERE id = 'default' AND coalesce(bonus_enabled, false) = false;