
ALTER TABLE public.user_debts
  ADD COLUMN IF NOT EXISTS claim_from_number text,
  ADD COLUMN IF NOT EXISTS claim_note text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE public.user_debts DROP CONSTRAINT IF EXISTS user_debts_status_check;
ALTER TABLE public.user_debts
  ADD CONSTRAINT user_debts_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'claimed'::text, 'resolved'::text]));
