ALTER TABLE public.user_devices
ADD COLUMN IF NOT EXISTS otp_trust_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS user_devices_otp_trust_idx
  ON public.user_devices (user_id, device_id, otp_trust_expires_at);