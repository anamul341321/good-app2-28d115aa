ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS reject_proof_path text,
  ADD COLUMN IF NOT EXISTS fee_refunded boolean NOT NULL DEFAULT false;