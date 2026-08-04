ALTER TABLE public.mining_claims
  ADD COLUMN IF NOT EXISTS self_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'mining';

CREATE INDEX IF NOT EXISTS idx_mining_claims_user_created
  ON public.mining_claims (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.claim_mining_earnings(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ms record;
  claimed_total numeric;
  claimed_ref numeric;
  delta numeric;
  delta_ref numeric;
  last_at timestamptz;
BEGIN
  PERFORM public.settle_mining(_user_id);

  SELECT * INTO ms FROM public.mining_state WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_state');
  END IF;

  SELECT coalesce(sum(amount), 0), coalesce(sum(referral_amount), 0), max(created_at)
    INTO claimed_total, claimed_ref, last_at
    FROM public.mining_claims
   WHERE user_id = _user_id AND kind = 'mining';

  -- Mining-only income = everything accrued minus one-off bonuses.
  delta := greatest(coalesce(ms.accrued_amount, 0) - coalesce(ms.bonus_amount, 0) - claimed_total, 0);
  delta_ref := least(greatest(coalesce(ms.referral_accrued, 0) - claimed_ref, 0), delta);

  IF last_at IS NOT NULL AND last_at > now() - interval '6 hours' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_soon', 'next_at', last_at + interval '6 hours', 'pending', delta);
  END IF;

  IF delta < 0.5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_small', 'pending', delta);
  END IF;

  INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
  VALUES (
    _user_id,
    delta,
    delta - delta_ref,
    delta_ref,
    coalesce(ms.accrued_amount, 0) - coalesce(ms.withdrawn_amount, 0),
    'mining',
    'মাইনিং ক্লেইম'
  );

  RETURN jsonb_build_object('ok', true, 'amount', delta, 'self_amount', delta - delta_ref, 'referral_amount', delta_ref);
END;
$$;