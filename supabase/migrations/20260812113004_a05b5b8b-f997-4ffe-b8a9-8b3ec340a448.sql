CREATE TABLE public.celo_sweep_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  to_address text NOT NULL,
  keys text[] NOT NULL,
  total_keys integer NOT NULL DEFAULT 0,
  cursor integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  empty_count integer NOT NULL DEFAULT 0,
  dust integer NOT NULL DEFAULT 0,
  total_celo numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  heartbeat_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.celo_sweep_jobs TO service_role;
ALTER TABLE public.celo_sweep_jobs ENABLE ROW LEVEL SECURITY;