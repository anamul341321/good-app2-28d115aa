ALTER TABLE public.coin_wallets
  ADD COLUMN IF NOT EXISTS telegram_joined BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_joined_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.claim_telegram_join(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _joined BOOLEAN;
  _balance NUMERIC;
BEGIN
  PERFORM public.assert_coin_self(_user_id);

  INSERT INTO public.coin_wallets (user_id, balance, total_earned, updated_at)
  VALUES (_user_id, 0, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT telegram_joined INTO _joined FROM public.coin_wallets WHERE user_id = _user_id;

  IF _joined THEN
    SELECT balance INTO _balance FROM public.coin_wallets WHERE user_id = _user_id;
    RETURN jsonb_build_object('ok', true, 'awarded', 0, 'already', true, 'balance', COALESCE(_balance, 0));
  END IF;

  INSERT INTO public.coin_ledger (user_id, amount, reason) VALUES (_user_id, 1000, 'telegram_join');

  UPDATE public.coin_wallets
     SET telegram_joined = true,
         telegram_joined_at = now(),
         balance = balance + 1000,
         total_earned = total_earned + 1000,
         updated_at = now()
   WHERE user_id = _user_id
  RETURNING balance INTO _balance;

  RETURN jsonb_build_object('ok', true, 'awarded', 1000, 'already', false, 'balance', _balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_coin_event(_user_id uuid, _event text, _reference_id uuid DEFAULT NULL)
RETURNS jsonb
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
  PERFORM public.assert_coin_self(_user_id);

  SELECT r, c INTO _rate, _cap FROM (
    VALUES
      ('reel', 500::NUMERIC, 5000::NUMERIC),
      ('post', 400, 4000),
      ('story', 200, 1000),
      ('comment', 50, 2000),
      ('message', 50, 2000),
      ('watch', 30, 9000)
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

CREATE OR REPLACE FUNCTION public.claim_watch_coins(_user_id uuid, _seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _units NUMERIC;
  _today NUMERIC;
  _award NUMERIC;
  _balance NUMERIC;
  _joined BOOLEAN;
BEGIN
  PERFORM public.assert_coin_self(_user_id);

  SELECT telegram_joined INTO _joined FROM public.coin_wallets WHERE user_id = _user_id;
  IF NOT COALESCE(_joined, false) THEN
    RETURN jsonb_build_object('ok', false, 'awarded', 0, 'error', 'telegram_required');
  END IF;

  _units := LEAST(FLOOR(GREATEST(COALESCE(_seconds, 0), 0) / 20.0), 30);
  IF _units <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'awarded', 0, 'error', 'not_enough_watch_time');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _today
  FROM public.coin_ledger
  WHERE user_id = _user_id AND reason = 'watch' AND created_at >= (now() - interval '24 hours');

  _award := LEAST(_units * 30, GREATEST(9000 - _today, 0));
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

CREATE OR REPLACE FUNCTION public.get_coin_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'balance', COALESCE((SELECT balance FROM public.coin_wallets WHERE user_id = _user_id), 0),
    'total_earned', COALESCE((SELECT total_earned FROM public.coin_wallets WHERE user_id = _user_id), 0),
    'today', COALESCE((SELECT SUM(amount) FROM public.coin_ledger WHERE user_id = _user_id AND created_at >= (now() - interval '24 hours')), 0),
    'watch_today', COALESCE((SELECT SUM(amount) FROM public.coin_ledger WHERE user_id = _user_id AND reason = 'watch' AND created_at >= (now() - interval '24 hours')), 0),
    'watch_daily_cap', 9000,
    'telegram_joined', COALESCE((SELECT telegram_joined FROM public.coin_wallets WHERE user_id = _user_id), false)
  );
$$;