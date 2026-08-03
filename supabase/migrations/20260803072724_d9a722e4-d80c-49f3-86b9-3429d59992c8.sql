CREATE TABLE public.password_reset_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  channel text NOT NULL DEFAULT 'telegram',
  attempts integer NOT NULL DEFAULT 0,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_otps_user ON public.password_reset_otps(user_id, created_at DESC);

GRANT ALL ON public.password_reset_otps TO service_role;
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;