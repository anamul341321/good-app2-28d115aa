
CREATE TABLE public.user_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  provider TEXT NOT NULL CHECK (provider IN ('bkash','nagad')),
  payment_number TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

GRANT SELECT ON public.user_debts TO authenticated;
GRANT ALL ON public.user_debts TO service_role;

ALTER TABLE public.user_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own debts"
  ON public.user_debts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_debts_user_status ON public.user_debts(user_id, status);
