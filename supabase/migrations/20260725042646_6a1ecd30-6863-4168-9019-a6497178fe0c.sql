CREATE TABLE public.admin_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_credits TO authenticated;
GRANT ALL ON public.admin_credits TO service_role;
ALTER TABLE public.admin_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all credits" ON public.admin_credits FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own credits" ON public.admin_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX admin_credits_user_idx ON public.admin_credits(user_id);
CREATE INDEX admin_credits_created_idx ON public.admin_credits(created_at DESC);