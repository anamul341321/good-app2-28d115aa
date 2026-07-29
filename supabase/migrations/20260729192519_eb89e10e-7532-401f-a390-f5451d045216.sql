CREATE TABLE public.tg_voices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  audio_path text NOT NULL,
  note text,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tg_voices TO service_role;
ALTER TABLE public.tg_voices ENABLE ROW LEVEL SECURITY;