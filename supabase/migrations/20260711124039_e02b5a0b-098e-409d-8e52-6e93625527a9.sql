
CREATE TABLE public.bonus_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bonus_vouchers_user_idx ON public.bonus_vouchers(user_id, status);
GRANT SELECT, UPDATE ON public.bonus_vouchers TO authenticated;
GRANT ALL ON public.bonus_vouchers TO service_role;
ALTER TABLE public.bonus_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vouchers read" ON public.bonus_vouchers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own vouchers claim" ON public.bonus_vouchers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
