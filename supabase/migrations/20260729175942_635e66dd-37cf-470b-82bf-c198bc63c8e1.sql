CREATE TABLE public.tg_bot_settings (
  id text PRIMARY KEY DEFAULT 'default',
  enabled boolean NOT NULL DEFAULT true,
  auto_reply_enabled boolean NOT NULL DEFAULT true,
  moderation_enabled boolean NOT NULL DEFAULT true,
  photo_analysis_enabled boolean NOT NULL DEFAULT true,
  group_chat_id text,
  admin_chat_id text,
  admin_mention text,
  persona text NOT NULL DEFAULT 'তুমি Good-App এর অফিসিয়াল সাপোর্ট বট। সবসময় ভদ্র, সংক্ষিপ্ত ও বাংলায় উত্তর দাও।',
  rules text NOT NULL DEFAULT '',
  banned_words text[] NOT NULL DEFAULT '{}',
  warn_threshold integer NOT NULL DEFAULT 3,
  delete_bad_messages boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tg_bot_settings TO service_role;
ALTER TABLE public.tg_bot_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tg_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  answer text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tg_faq TO service_role;
ALTER TABLE public.tg_faq ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tg_messages (
  update_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  message_id bigint,
  tg_user_id bigint,
  username text,
  full_name text,
  text text,
  has_photo boolean NOT NULL DEFAULT false,
  verdict text,
  action text,
  bot_reply text,
  matched_uid text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tg_messages_created ON public.tg_messages (created_at DESC);
CREATE INDEX idx_tg_messages_user ON public.tg_messages (tg_user_id);
GRANT ALL ON public.tg_messages TO service_role;
ALTER TABLE public.tg_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tg_offenders (
  tg_user_id bigint PRIMARY KEY,
  username text,
  full_name text,
  warn_count integer NOT NULL DEFAULT 0,
  last_reason text,
  last_offense_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tg_offenders TO service_role;
ALTER TABLE public.tg_offenders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tg_ban_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_user_id bigint,
  username text,
  full_name text,
  reason text NOT NULL,
  evidence text,
  matched_uid text,
  app_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tg_ban_requests_status ON public.tg_ban_requests (status, created_at DESC);
GRANT ALL ON public.tg_ban_requests TO service_role;
ALTER TABLE public.tg_ban_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_reason text,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_user_id bigint;

INSERT INTO public.tg_bot_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;