CREATE TABLE public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type text NOT NULL CHECK (call_type IN ('audio', 'video')),
  status text NOT NULL DEFAULT 'calling' CHECK (status IN ('calling', 'ringing', 'accepted', 'declined', 'missed', 'ended', 'failed', 'cancelled')),
  offer jsonb,
  answer jsonb,
  ended_reason text,
  ringing_at timestamptz,
  accepted_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT call_sessions_different_users CHECK (caller_id <> callee_id)
);

GRANT SELECT, INSERT, UPDATE ON public.call_sessions TO authenticated;
GRANT ALL ON public.call_sessions TO service_role;

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Call participants can view calls"
ON public.call_sessions FOR SELECT TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Callers can create calls"
ON public.call_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = caller_id AND caller_id <> callee_id);

CREATE POLICY "Call participants can update calls"
ON public.call_sessions FOR UPDATE TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id)
WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE INDEX call_sessions_callee_recent_idx ON public.call_sessions (callee_id, created_at DESC);
CREATE INDEX call_sessions_caller_recent_idx ON public.call_sessions (caller_id, created_at DESC);
CREATE INDEX call_sessions_open_idx ON public.call_sessions (callee_id, status, created_at DESC)
WHERE status IN ('calling', 'ringing');

CREATE OR REPLACE FUNCTION public.set_call_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_call_sessions_updated_at
BEFORE UPDATE ON public.call_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_call_sessions_updated_at();