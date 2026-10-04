CREATE TABLE public.support_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_user_id uuid,
  caller_uid integer,
  caller_name text,
  caller_phone text,
  status text NOT NULL DEFAULT 'ringing',
  answered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.support_calls TO service_role;
ALTER TABLE public.support_calls ENABLE ROW LEVEL SECURITY;