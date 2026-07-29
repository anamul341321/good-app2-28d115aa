CREATE TABLE IF NOT EXISTS public.tg_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_user_id bigint NOT NULL,
  chat_id bigint NOT NULL,
  intent text NOT NULL,
  step text NOT NULL,
  uid text,
  app_user_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '20 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tg_user_id, chat_id)
);

GRANT ALL ON public.tg_sessions TO service_role;

ALTER TABLE public.tg_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to tg sessions"
  ON public.tg_sessions FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.tg_bot_settings
  ADD COLUMN IF NOT EXISTS slot_reset_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ask_slot_message text NOT NULL DEFAULT 'কোন নম্বর স্লটটি রিসেট করতে চান? (১ থেকে ১০ এর মধ্যে একটি নম্বর লিখুন)';
