ALTER TABLE public.tg_offenders
  ADD COLUMN IF NOT EXISTS known_uid text,
  ADD COLUMN IF NOT EXISTS app_user_id uuid,
  ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS unblocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS chat_id bigint,
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE public.tg_bot_settings
  ADD COLUMN IF NOT EXISTS smart_mode boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_block_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS block_threshold integer NOT NULL DEFAULT 5;