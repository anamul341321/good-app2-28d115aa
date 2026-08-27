ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_active_at_idx ON public.profiles (last_active_at DESC);

CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET last_active_at = now() WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.touch_presence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_presence() TO service_role;