ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_uidx
  ON public.profiles (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.email_verify_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_verify_otps TO service_role;
ALTER TABLE public.email_verify_otps ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS email_verify_otps_user_idx ON public.email_verify_otps (user_id, created_at DESC);