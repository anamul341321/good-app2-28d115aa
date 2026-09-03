CREATE TABLE IF NOT EXISTS public.daily_activity (
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  day DATE NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

GRANT SELECT ON public.daily_activity TO authenticated;
GRANT ALL ON public.daily_activity TO service_role;
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own activity read" ON public.daily_activity;
CREATE POLICY "own activity read" ON public.daily_activity
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_daily_activity(_user_id uuid, _seconds integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _day date := (now() + interval '6 hours')::date;
  _add integer := LEAST(GREATEST(COALESCE(_seconds, 0), 0), 120);
  _total integer;
BEGIN
  INSERT INTO public.daily_activity (user_id, day, seconds, updated_at)
  VALUES (_user_id, _day, _add, now())
  ON CONFLICT (user_id, day)
  DO UPDATE SET seconds = LEAST(public.daily_activity.seconds + _add, 86400), updated_at = now()
  RETURNING seconds INTO _total;

  RETURN json_build_object('seconds', _total, 'required', 3600, 'ok', _total >= 3600, 'day', _day);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_activity(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _day date := (now() + interval '6 hours')::date;
  _total integer;
BEGIN
  SELECT COALESCE(seconds, 0) INTO _total
  FROM public.daily_activity WHERE user_id = _user_id AND day = _day;
  _total := COALESCE(_total, 0);
  RETURN json_build_object('seconds', _total, 'required', 3600, 'ok', _total >= 3600, 'day', _day);
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_daily_activity(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_activity(uuid) TO authenticated, service_role;