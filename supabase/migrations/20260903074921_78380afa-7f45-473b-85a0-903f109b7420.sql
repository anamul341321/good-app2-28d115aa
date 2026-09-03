ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'BD';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locale text;