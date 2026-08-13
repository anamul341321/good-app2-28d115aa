ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS tg_chat_id text,
  ADD COLUMN IF NOT EXISTS tg_message_id bigint;