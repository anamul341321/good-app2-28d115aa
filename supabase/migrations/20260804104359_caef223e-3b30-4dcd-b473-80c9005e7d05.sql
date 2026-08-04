ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS approval_state TEXT,
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS user_devices_pending_idx
  ON public.user_devices (user_id, approval_state);