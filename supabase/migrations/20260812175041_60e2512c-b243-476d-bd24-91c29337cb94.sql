CREATE TABLE IF NOT EXISTS public.admin_push_targets (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_push_targets TO service_role;
ALTER TABLE public.admin_push_targets ENABLE ROW LEVEL SECURITY;