CREATE TABLE IF NOT EXISTS public.admin_settings (
  id text PRIMARY KEY,
  password_hash text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: table is server-only via service role.
INSERT INTO public.admin_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;