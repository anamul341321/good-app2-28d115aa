CREATE TABLE public.slot_reset_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slots integer[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  requested_by text,
  tg_chat_id text,
  tg_user_id bigint,
  tg_message_id bigint,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, UPDATE ON public.slot_reset_requests TO authenticated;
GRANT ALL ON public.slot_reset_requests TO service_role;

ALTER TABLE public.slot_reset_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reset requests"
ON public.slot_reset_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can respond to their own reset requests"
ON public.slot_reset_requests FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_slot_reset_requests_user_status ON public.slot_reset_requests (user_id, status);

CREATE OR REPLACE FUNCTION public.touch_slot_reset_requests()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_slot_reset_requests_updated_at
BEFORE UPDATE ON public.slot_reset_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_slot_reset_requests();