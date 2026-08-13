-- ===== friend_messages upgrade =====
ALTER TABLE public.friend_messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_meta jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS reply_to uuid;

ALTER TABLE public.friend_messages ALTER COLUMN receiver_id DROP NOT NULL;
ALTER TABLE public.friend_messages ALTER COLUMN body SET DEFAULT '';
ALTER TABLE public.friend_messages DROP CONSTRAINT IF EXISTS friend_messages_not_self;
ALTER TABLE public.friend_messages DROP CONSTRAINT IF EXISTS friend_messages_target_chk;
ALTER TABLE public.friend_messages
  ADD CONSTRAINT friend_messages_target_chk
  CHECK (
    (group_id IS NOT NULL AND receiver_id IS NULL)
    OR (group_id IS NULL AND receiver_id IS NOT NULL AND receiver_id <> sender_id)
  );

-- ===== groups =====
CREATE TABLE IF NOT EXISTS public.chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  avatar_url text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_group_members (
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE public.friend_messages
  DROP CONSTRAINT IF EXISTS friend_messages_group_fk;
ALTER TABLE public.friend_messages
  ADD CONSTRAINT friend_messages_group_fk
  FOREIGN KEY (group_id) REFERENCES public.chat_groups(id) ON DELETE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_groups TO authenticated;
GRANT ALL ON public.chat_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_group_members TO authenticated;
GRANT ALL ON public.chat_group_members TO service_role;

ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_group_members m
    WHERE m.group_id = _group AND m.user_id = _user
  )
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_group_members m
    WHERE m.group_id = _group AND m.user_id = _user AND m.role = 'admin'
  )
$$;

DROP POLICY IF EXISTS "Members see group" ON public.chat_groups;
CREATE POLICY "Members see group" ON public.chat_groups
  FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Create group" ON public.chat_groups;
CREATE POLICY "Create group" ON public.chat_groups
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Admin updates group" ON public.chat_groups;
CREATE POLICY "Admin updates group" ON public.chat_groups
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(id, auth.uid()) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Creator deletes group" ON public.chat_groups;
CREATE POLICY "Creator deletes group" ON public.chat_groups
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "See group members" ON public.chat_group_members;
CREATE POLICY "See group members" ON public.chat_group_members
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admin adds members" ON public.chat_group_members;
CREATE POLICY "Admin adds members" ON public.chat_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_group_admin(group_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.chat_groups g WHERE g.id = group_id AND g.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Member updates own row" ON public.chat_group_members;
CREATE POLICY "Member updates own row" ON public.chat_group_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Leave or admin removes" ON public.chat_group_members;
CREATE POLICY "Leave or admin removes" ON public.chat_group_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

-- ===== message policies =====
DROP POLICY IF EXISTS "See own conversations" ON public.friend_messages;
CREATE POLICY "See own conversations" ON public.friend_messages
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Send own messages to friends" ON public.friend_messages;
CREATE POLICY "Send messages" ON public.friend_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      receiver_id IS NOT NULL
      OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Receiver marks read" ON public.friend_messages;
CREATE POLICY "Receiver marks read" ON public.friend_messages
  FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid() OR sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS friend_messages_group_idx
  ON public.friend_messages (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_group_members_user_idx
  ON public.chat_group_members (user_id);

ALTER TABLE public.chat_groups REPLICA IDENTITY FULL;
ALTER TABLE public.chat_group_members REPLICA IDENTITY FULL;
