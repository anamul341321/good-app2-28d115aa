CREATE TABLE public.friend_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friend_messages_not_self CHECK (sender_id <> receiver_id)
);

GRANT SELECT, INSERT, UPDATE ON public.friend_messages TO authenticated;
GRANT ALL ON public.friend_messages TO service_role;

ALTER TABLE public.friend_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See own conversations" ON public.friend_messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Send own messages to friends" ON public.friend_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.friend_links fl
      WHERE fl.status = 'accepted'
        AND ((fl.requester_id = auth.uid() AND fl.addressee_id = friend_messages.receiver_id)
          OR (fl.addressee_id = auth.uid() AND fl.requester_id = friend_messages.receiver_id))
    )
  );

CREATE POLICY "Receiver marks read" ON public.friend_messages
  FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

CREATE INDEX friend_messages_pair_idx ON public.friend_messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX friend_messages_unread_idx ON public.friend_messages (receiver_id, read_at);

ALTER TABLE public.friend_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_messages;