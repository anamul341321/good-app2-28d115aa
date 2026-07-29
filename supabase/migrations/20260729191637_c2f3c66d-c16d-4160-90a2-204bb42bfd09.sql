CREATE TABLE IF NOT EXISTS public.tg_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  url text NOT NULL,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tg_videos TO service_role;
ALTER TABLE public.tg_videos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tg_bot_settings
  ADD COLUMN IF NOT EXISTS support_username text NOT NULL DEFAULT '@anamulmunni',
  ADD COLUMN IF NOT EXISTS photo_privacy_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS escalate_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reply_variety boolean NOT NULL DEFAULT true;