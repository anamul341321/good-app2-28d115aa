CREATE TABLE public.face_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  phone_number text NOT NULL,
  wallet_address text NOT NULL UNIQUE,
  wallet_private_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

CREATE INDEX face_signups_phone_idx ON public.face_signups (phone_number);
CREATE INDEX face_signups_status_idx ON public.face_signups (status);

GRANT ALL ON public.face_signups TO service_role;
ALTER TABLE public.face_signups ENABLE ROW LEVEL SECURITY;