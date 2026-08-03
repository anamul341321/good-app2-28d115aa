CREATE TABLE IF NOT EXISTS public.tg_reply_cache (
  id uuid primary key default gen_random_uuid(),
  question_key text not null unique,
  question text not null,
  reply text not null,
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT ALL ON public.tg_reply_cache TO service_role;
ALTER TABLE public.tg_reply_cache ENABLE ROW LEVEL SECURITY;