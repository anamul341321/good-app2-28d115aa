ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS maintenance_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message text;

CREATE TABLE IF NOT EXISTS public.user_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_notices_user_idx ON public.user_notices (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.user_notices TO authenticated;
GRANT ALL ON public.user_notices TO service_role;

ALTER TABLE public.user_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own notices select" ON public.user_notices;
CREATE POLICY "own notices select" ON public.user_notices
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own notices update" ON public.user_notices;
CREATE POLICY "own notices update" ON public.user_notices
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());