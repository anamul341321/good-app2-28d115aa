ALTER TABLE public.tg_bot_settings
  ADD COLUMN IF NOT EXISTS voice_reply_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS voice_text_enabled boolean NOT NULL DEFAULT true;