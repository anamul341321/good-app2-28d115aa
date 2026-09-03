CREATE TABLE IF NOT EXISTS public.coin_shop_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  item_kind text not null,
  cost integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, item_key)
);
GRANT SELECT, INSERT ON public.coin_shop_purchases TO authenticated;
GRANT ALL ON public.coin_shop_purchases TO service_role;
ALTER TABLE public.coin_shop_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own purchases read" ON public.coin_shop_purchases FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.coin_cosmetics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_key text not null default 'default',
  emoji_key text not null default 'classic',
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.coin_cosmetics TO authenticated;
GRANT ALL ON public.coin_cosmetics TO service_role;
ALTER TABLE public.coin_cosmetics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cosmetics read" ON public.coin_cosmetics FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own cosmetics write" ON public.coin_cosmetics FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.buy_cosmetic(_user_id uuid, _item_key text, _item_kind text, _cost integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bal integer;
BEGIN
  IF _cost < 0 OR _cost > 1000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_cost');
  END IF;

  IF EXISTS (SELECT 1 FROM public.coin_shop_purchases WHERE user_id = _user_id AND item_key = _item_key) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  INSERT INTO public.coin_wallets (user_id) VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO _bal FROM public.coin_wallets WHERE user_id = _user_id FOR UPDATE;

  IF coalesce(_bal, 0) < _cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient', 'balance', coalesce(_bal, 0));
  END IF;

  UPDATE public.coin_wallets
     SET balance = balance - _cost, updated_at = now()
   WHERE user_id = _user_id;

  INSERT INTO public.coin_ledger (user_id, amount, reason)
  VALUES (_user_id, -_cost, 'shop_' || _item_kind);

  INSERT INTO public.coin_shop_purchases (user_id, item_key, item_kind, cost)
  VALUES (_user_id, _item_key, _item_kind, _cost);

  SELECT balance INTO _bal FROM public.coin_wallets WHERE user_id = _user_id;
  RETURN jsonb_build_object('ok', true, 'already', false, 'balance', _bal);
END;
$$;
REVOKE ALL ON FUNCTION public.buy_cosmetic(uuid, text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.buy_cosmetic(uuid, text, text, integer) TO authenticated, service_role;