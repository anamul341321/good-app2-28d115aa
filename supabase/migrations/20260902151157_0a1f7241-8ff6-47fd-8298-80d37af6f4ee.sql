CREATE TABLE IF NOT EXISTS public.coin_ad_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  coins NUMERIC NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coin_ad_views_user_time ON public.coin_ad_views (user_id, created_at DESC);
GRANT SELECT ON public.coin_ad_views TO authenticated;
GRANT ALL ON public.coin_ad_views TO service_role;
ALTER TABLE public.coin_ad_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own ad views" ON public.coin_ad_views;
CREATE POLICY "own ad views" ON public.coin_ad_views FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_ad_coin_status(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _coins NUMERIC := 1000;
  _per_break INT := 2;
  _cooldown INT := 360;      -- 6 মিনিট
  _daily_limit INT := 30;
  _today INT;
  _streak INT;
  _last TIMESTAMPTZ;
  _wait INT := 0;
BEGIN
  PERFORM public.assert_coin_self(_user_id);

  SELECT COUNT(*) INTO _today FROM public.coin_ad_views
   WHERE user_id = _user_id AND created_at >= (now() - interval '24 hours');

  SELECT MAX(created_at) INTO _last FROM public.coin_ad_views WHERE user_id = _user_id;

  -- সর্বশেষ cooldown-এর পর কতটি অ্যাড দেখা হয়েছে
  SELECT COUNT(*) INTO _streak FROM public.coin_ad_views
   WHERE user_id = _user_id AND created_at >= (now() - make_interval(secs => _cooldown));

  IF _streak >= _per_break AND _last IS NOT NULL THEN
    _wait := GREATEST(0, _cooldown - FLOOR(EXTRACT(EPOCH FROM (now() - _last)))::INT);
  END IF;

  RETURN jsonb_build_object(
    'coins_per_ad', _coins,
    'ads_per_break', _per_break,
    'cooldown_seconds', _cooldown,
    'daily_limit', _daily_limit,
    'today_count', _today,
    'streak', _streak,
    'wait_seconds', _wait,
    'can_watch', (_today < _daily_limit AND _wait = 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_ad_coins(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _st jsonb;
  _coins NUMERIC;
  _balance NUMERIC;
BEGIN
  PERFORM public.assert_coin_self(_user_id);
  _st := public.get_ad_coin_status(_user_id);

  IF NOT (_st->>'can_watch')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'awarded', 0,
      'error', CASE WHEN (_st->>'wait_seconds')::int > 0 THEN 'cooldown' ELSE 'daily_limit' END,
      'status', _st);
  END IF;

  _coins := (_st->>'coins_per_ad')::numeric;

  INSERT INTO public.coin_ad_views (user_id, coins) VALUES (_user_id, _coins);
  INSERT INTO public.coin_ledger (user_id, amount, reason) VALUES (_user_id, _coins, 'ad_watch');

  INSERT INTO public.coin_wallets (user_id, balance, total_earned, updated_at)
  VALUES (_user_id, _coins, _coins, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.coin_wallets.balance + _coins,
        total_earned = public.coin_wallets.total_earned + _coins,
        updated_at = now()
  RETURNING balance INTO _balance;

  RETURN jsonb_build_object('ok', true, 'awarded', _coins, 'balance', _balance,
                            'status', public.get_ad_coin_status(_user_id));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_ad_coin_status(uuid) FROM public;
REVOKE ALL ON FUNCTION public.claim_ad_coins(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_ad_coin_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_ad_coins(uuid) TO authenticated, service_role;