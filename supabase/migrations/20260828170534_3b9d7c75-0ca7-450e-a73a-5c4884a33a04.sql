CREATE TABLE public.ad_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  view_day date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Dhaka')::date),
  cycle_month date NOT NULL DEFAULT (date_trunc('month', (now() AT TIME ZONE 'Asia/Dhaka'))::date),
  kind text NOT NULL DEFAULT 'rewarded',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ad_views_user_cycle_idx ON public.ad_views (user_id, cycle_month);
CREATE INDEX ad_views_user_day_idx ON public.ad_views (user_id, view_day);

GRANT SELECT ON public.ad_views TO authenticated;
GRANT ALL ON public.ad_views TO service_role;

ALTER TABLE public.ad_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ad views"
ON public.ad_views FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_ad_view(_daily_limit int DEFAULT 5, _max_boosts int DEFAULT 5, _ads_per_boost int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := ((now() AT TIME ZONE 'Asia/Dhaka')::date);
  _cycle date := (date_trunc('month', (now() AT TIME ZONE 'Asia/Dhaka'))::date);
  _today_count int;
  _cycle_count int;
  _boosts int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT count(*) INTO _today_count FROM ad_views WHERE user_id = _uid AND view_day = _today;
  SELECT count(*) INTO _cycle_count FROM ad_views WHERE user_id = _uid AND cycle_month = _cycle;

  IF _today_count >= _daily_limit THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'daily_limit',
      'today_count', _today_count, 'cycle_count', _cycle_count,
      'boosts', least(_cycle_count / _ads_per_boost, _max_boosts));
  END IF;

  IF _cycle_count >= _max_boosts * _ads_per_boost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cycle_limit',
      'today_count', _today_count, 'cycle_count', _cycle_count, 'boosts', _max_boosts);
  END IF;

  INSERT INTO ad_views (user_id, view_day, cycle_month) VALUES (_uid, _today, _cycle);
  _today_count := _today_count + 1;
  _cycle_count := _cycle_count + 1;
  _boosts := least(_cycle_count / _ads_per_boost, _max_boosts);

  RETURN jsonb_build_object('ok', true, 'today_count', _today_count,
    'cycle_count', _cycle_count, 'boosts', _boosts);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_ad_view(int, int, int) TO authenticated;