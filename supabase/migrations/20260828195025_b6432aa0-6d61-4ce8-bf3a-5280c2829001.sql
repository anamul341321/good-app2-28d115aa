CREATE TABLE IF NOT EXISTS public.coin_telegram_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username_lc text not null,
  tg_user_id bigint,
  claimed_at timestamptz not null default now()
);
CREATE UNIQUE INDEX IF NOT EXISTS coin_telegram_claims_username_key ON public.coin_telegram_claims (username_lc);
CREATE UNIQUE INDEX IF NOT EXISTS coin_telegram_claims_user_key ON public.coin_telegram_claims (user_id);
GRANT SELECT ON public.coin_telegram_claims TO authenticated;
GRANT ALL ON public.coin_telegram_claims TO service_role;
ALTER TABLE public.coin_telegram_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own telegram claim read" ON public.coin_telegram_claims;
CREATE POLICY "own telegram claim read" ON public.coin_telegram_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);