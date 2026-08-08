ALTER TABLE public.mining_state
  ADD COLUMN IF NOT EXISTS mining_withdrawn numeric NOT NULL DEFAULT 0;

UPDATE public.mining_state
SET mining_withdrawn = LEAST(
  COALESCE(withdrawn_amount, 0),
  COALESCE(self_mining_accrued, 0) + COALESCE(referral_accrued, 0)
)
WHERE mining_withdrawn = 0;