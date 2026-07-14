
CREATE TABLE IF NOT EXISTS public.bonus_settings (
  id text PRIMARY KEY DEFAULT 'default',
  first_verify_bonus integer NOT NULL DEFAULT 50,
  reverify_bonus integer NOT NULL DEFAULT 200,
  referrer_bonus integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bonus_settings TO authenticated;
GRANT ALL ON public.bonus_settings TO service_role;

ALTER TABLE public.bonus_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read bonus settings" ON public.bonus_settings;
CREATE POLICY "auth read bonus settings" ON public.bonus_settings
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.bonus_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_first_verify_self_claimed boolean NOT NULL DEFAULT false;
