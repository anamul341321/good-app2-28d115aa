CREATE OR REPLACE FUNCTION public.mining_withdraw_window_open(_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (_now AT TIME ZONE 'Asia/Dhaka')
         < date_trunc('month', (_now AT TIME ZONE 'Asia/Dhaka')) + interval '2 days 22 hours';
$$;
GRANT EXECUTE ON FUNCTION public.mining_withdraw_window_open(timestamptz) TO authenticated, anon, service_role;