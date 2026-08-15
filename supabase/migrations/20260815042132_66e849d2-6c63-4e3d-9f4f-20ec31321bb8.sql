-- Migration to add social friendships and user stats
CREATE TABLE IF NOT EXISTS public.friendships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    friend_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(user_id, friend_id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

-- RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'friendships' AND policyname = 'Users can view their own friendships'
    ) THEN
        CREATE POLICY "Users can view their own friendships" ON public.friendships
            FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'friendships' AND policyname = 'Users can manage their own friendships'
    ) THEN
        CREATE POLICY "Users can manage their own friendships" ON public.friendships
            FOR ALL TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);
    END IF;
END $$;
