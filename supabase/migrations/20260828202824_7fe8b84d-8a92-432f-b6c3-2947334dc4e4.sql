CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.friend_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants can view reactions" ON public.message_reactions FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.friend_messages fm
    WHERE fm.id = message_reactions.message_id
      AND (fm.sender_id = auth.uid() OR fm.receiver_id = auth.uid() OR fm.group_id IS NOT NULL)
  )
);
CREATE POLICY "users manage own reaction" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own reaction" ON public.message_reactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own reaction" ON public.message_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_message_reactions_msg ON public.message_reactions (message_id);