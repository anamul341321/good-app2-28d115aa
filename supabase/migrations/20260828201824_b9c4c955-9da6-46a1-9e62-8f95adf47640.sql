-- Telegram join reward: 1000 -> 5000
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

  INSERT INTO public.coin_ledger (user_id, amount, reason) VALUES (_user_id, 5000, 'telegram_join');

  UPDATE public.coin_wallets
     SET telegram_joined = true,
         telegram_joined_at = now(),
         balance = balance + 5000,
         total_earned = total_earned + 5000,
         updated_at = now()
   WHERE user_id = _user_id
  RETURNING balance INTO _balance;

  RETURN jsonb_build_object('ok', true, 'awarded', 5000, 'already', false, 'balance', _balance);
END;
$$;

-- Today's activity progress for the daily check-in
CREATE OR REPLACE FUNCTION public.get_daily_checkin(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka';
  _likes INT;
  _comments INT;
  _messages INT;
  _claimed BOOLEAN;
BEGIN
  PERFORM public.assert_coin_self(_user_id);

  SELECT count(*) INTO _likes FROM public.post_reactions
   WHERE user_id = _user_id AND created_at >= _start;
  _likes := _likes + COALESCE((SELECT count(*) FROM public.post_likes
    WHERE user_id = _user_id AND created_at >= _start), 0);

  SELECT count(*) INTO _comments FROM public.post_comments
   WHERE user_id = _user_id AND created_at >= _start;

  SELECT count(*) INTO _messages FROM public.friend_messages
   WHERE sender_id = _user_id AND created_at >= _start;

  SELECT EXISTS (
    SELECT 1 FROM public.coin_ledger
     WHERE user_id = _user_id AND reason = 'daily_checkin' AND created_at >= _start
  ) INTO _claimed;

  RETURN jsonb_build_object(
    'likes', _likes, 'comments', _comments, 'messages', _messages,
    'need_likes', 5, 'need_comments', 2, 'need_messages', 3,
    'reward', 1000, 'claimed', _claimed,
    'eligible', (_likes >= 5 AND _comments >= 2 AND _messages >= 3 AND NOT _claimed)
  );
END;
$$;

-- Claim the daily check-in reward (once per day)
CREATE OR REPLACE FUNCTION public.claim_daily_checkin(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p jsonb;
  _balance NUMERIC;
BEGIN
  PERFORM public.assert_coin_self(_user_id);

  INSERT INTO public.coin_wallets (user_id, balance, total_earned, updated_at)
  VALUES (_user_id, 0, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  _p := public.get_daily_checkin(_user_id);

  IF (_p->>'claimed')::boolean THEN
    SELECT balance INTO _balance FROM public.coin_wallets WHERE user_id = _user_id;
    RETURN jsonb_build_object('ok', true, 'awarded', 0, 'already', true,
                              'balance', COALESCE(_balance, 0), 'progress', _p);
  END IF;

  IF NOT (_p->>'eligible')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'awarded', 0, 'reason', 'incomplete', 'progress', _p);
  END IF;

  INSERT INTO public.coin_ledger (user_id, amount, reason)
  VALUES (_user_id, 1000, 'daily_checkin');

  UPDATE public.coin_wallets
     SET balance = balance + 1000,
         total_earned = total_earned + 1000,
         updated_at = now()
   WHERE user_id = _user_id
  RETURNING balance INTO _balance;

  RETURN jsonb_build_object('ok', true, 'awarded', 1000, 'already', false,
                            'balance', _balance, 'progress', public.get_daily_checkin(_user_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_checkin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin(uuid) TO authenticated;