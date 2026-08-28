-- Coin reward system
CREATE TABLE IF NOT EXISTS public.coin_wallets (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  total_earned NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coin_ledger_user_day_idx ON public.coin_ledger (user_id, reason, created_at DESC);

GRANT SELECT ON public.coin_wallets TO authenticated;
GRANT ALL ON public.coin_wallets TO service_role;
GRANT SELECT ON public.coin_ledger TO authenticated;
GRANT ALL ON public.coin_ledger TO service_role;

ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own coin wallet" ON public.coin_wallets;
CREATE POLICY "own coin wallet" ON public.coin_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own coin ledger" ON public.coin_ledger;
CREATE POLICY "own coin ledger" ON public.coin_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Award coins for an in-app activity with per-day caps
CREATE OR REPLACE FUNCTION public.award_coin_event(_user_id UUID, _event TEXT, _reference_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rate NUMERIC;
  _cap NUMERIC;
  _today NUMERIC;
  _award NUMERIC;
  _balance NUMERIC;
BEGIN
  SELECT r, c INTO _rate, _cap FROM (
    VALUES
      ('reel', 12::NUMERIC, 120::NUMERIC),
      ('post', 10, 100),
      ('story', 4, 20),
      ('comment', 1, 20),
      ('message', 1, 30),
      ('watch', 1, 600)
  ) AS t(e, r, c) WHERE t.e = _event;

  IF _rate IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_event');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _today
  FROM public.coin_ledger
  WHERE user_id = _user_id AND reason = _event AND created_at >= (now() - interval '24 hours');

  _award := LEAST(_rate, GREATEST(_cap - _today, 0));

  IF _award <= 0 THEN
    SELECT COALESCE(balance, 0) INTO _balance FROM public.coin_wallets WHERE user_id = _user_id;
    RETURN jsonb_build_object('ok', true, 'awarded', 0, 'capped', true, 'balance', COALESCE(_balance, 0));
  END IF;

  INSERT INTO public.coin_ledger (user_id, amount, reason, reference_id)
  VALUES (_user_id, _award, _event, _reference_id);

  INSERT INTO public.coin_wallets (user_id, balance, total_earned, updated_at)
  VALUES (_user_id, _award, _award, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.coin_wallets.balance + _award,
        total_earned = public.coin_wallets.total_earned + _award,
        updated_at = now()
  RETURNING balance INTO _balance;

  RETURN jsonb_build_object('ok', true, 'awarded', _award, 'capped', false, 'balance', _balance);
END;
$$;

-- Claim coins for watched video seconds (1 coin per 20s, max 30 per claim)
CREATE OR REPLACE FUNCTION public.claim_watch_coins(_user_id UUID, _seconds INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _units NUMERIC;
  _today NUMERIC;
  _award NUMERIC;
  _balance NUMERIC;
BEGIN
  _units := LEAST(FLOOR(GREATEST(COALESCE(_seconds, 0), 0) / 20.0), 30);
  IF _units <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'awarded', 0, 'error', 'not_enough_watch_time');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _today
  FROM public.coin_ledger
  WHERE user_id = _user_id AND reason = 'watch' AND created_at >= (now() - interval '24 hours');

  _award := LEAST(_units, GREATEST(600 - _today, 0));
  IF _award <= 0 THEN
    SELECT COALESCE(balance, 0) INTO _balance FROM public.coin_wallets WHERE user_id = _user_id;
    RETURN jsonb_build_object('ok', true, 'awarded', 0, 'capped', true, 'balance', COALESCE(_balance, 0));
  END IF;

  INSERT INTO public.coin_ledger (user_id, amount, reason) VALUES (_user_id, _award, 'watch');

  INSERT INTO public.coin_wallets (user_id, balance, total_earned, updated_at)
  VALUES (_user_id, _award, _award, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.coin_wallets.balance + _award,
        total_earned = public.coin_wallets.total_earned + _award,
        updated_at = now()
  RETURNING balance INTO _balance;

  RETURN jsonb_build_object('ok', true, 'awarded', _award, 'capped', false, 'balance', _balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_coin_summary(_user_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'balance', COALESCE((SELECT balance FROM public.coin_wallets WHERE user_id = _user_id), 0),
    'total_earned', COALESCE((SELECT total_earned FROM public.coin_wallets WHERE user_id = _user_id), 0),
    'today', COALESCE((SELECT SUM(amount) FROM public.coin_ledger WHERE user_id = _user_id AND created_at >= (now() - interval '24 hours')), 0),
    'watch_today', COALESCE((SELECT SUM(amount) FROM public.coin_ledger WHERE user_id = _user_id AND reason = 'watch' AND created_at >= (now() - interval '24 hours')), 0),
    'watch_daily_cap', 600
  );
$$;