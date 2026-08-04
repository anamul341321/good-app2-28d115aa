CREATE TABLE IF NOT EXISTS public.ai_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key text NOT NULL UNIQUE,
  label text,
  active boolean NOT NULL DEFAULT true,
  exhausted_until timestamptz,
  calls integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_keys TO service_role;
ALTER TABLE public.ai_keys ENABLE ROW LEVEL SECURITY;