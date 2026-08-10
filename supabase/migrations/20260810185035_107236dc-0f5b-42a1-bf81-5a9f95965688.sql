ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS auto_payout_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_payout_max numeric NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS auto_payout_kyc_only boolean NOT NULL DEFAULT true;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS payout_provider text,
  ADD COLUMN IF NOT EXISTS payout_trxid text,
  ADD COLUMN IF NOT EXISTS payout_status text,
  ADD COLUMN IF NOT EXISTS payout_message text,
  ADD COLUMN IF NOT EXISTS payout_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS withdrawals_payout_status_idx ON public.withdrawals (payout_status) WHERE payout_status IS NOT NULL;