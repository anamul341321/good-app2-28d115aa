CREATE TABLE public.gd_transfer_daily (
  day date NOT NULL PRIMARY KEY,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  finalized boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.gd_transfer_daily TO service_role;
ALTER TABLE public.gd_transfer_daily ENABLE ROW LEVEL SECURITY;