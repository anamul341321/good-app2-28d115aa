-- Create stories table
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ensure RLS is enabled for all social tables
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notices ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reactions TO authenticated;
GRANT ALL ON public.post_reactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;

GRANT SELECT, UPDATE ON public.user_notices TO authenticated;
GRANT ALL ON public.user_notices TO service_role;

-- Policies for posts
DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

CREATE POLICY "Anyone can read posts" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Policies for post_reactions
DROP POLICY IF EXISTS "Anyone can read reactions" ON public.post_reactions;
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.post_reactions;
DROP POLICY IF EXISTS "Users can react" ON public.post_reactions;
DROP POLICY IF EXISTS "Users can manage their own reactions" ON public.post_reactions;

CREATE POLICY "Anyone can read reactions" ON public.post_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can react" ON public.post_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their reaction" ON public.post_reactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their reaction" ON public.post_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Policies for post_comments
DROP POLICY IF EXISTS "Anyone can read comments" ON public.post_comments;
DROP POLICY IF EXISTS "Anyone can view comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can comment" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create their own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.post_comments;

CREATE POLICY "Anyone can read comments" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can comment" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their comments" ON public.post_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their comments" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Policies for stories
DROP POLICY IF EXISTS "Anyone can read active stories" ON public.stories;
DROP POLICY IF EXISTS "Users can create stories" ON public.stories;
DROP POLICY IF EXISTS "Users can delete their own stories" ON public.stories;

CREATE POLICY "Anyone can read active stories" ON public.stories FOR SELECT TO authenticated USING (expires_at > NOW());
CREATE POLICY "Users can create stories" ON public.stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own stories" ON public.stories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Policies for user_notices
DROP POLICY IF EXISTS "own notices select" ON public.user_notices;
DROP POLICY IF EXISTS "own notices update" ON public.user_notices;

CREATE POLICY "Users can read their own notices" ON public.user_notices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notices" ON public.user_notices FOR UPDATE TO authenticated USING (auth.uid() = user_id);
