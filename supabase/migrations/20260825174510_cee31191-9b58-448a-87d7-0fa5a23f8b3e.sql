
-- profiles extras
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified_badge boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_reels_seen_at timestamptz;

-- posts extras (feed shape)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0;

-- comments extras
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE;
ALTER TABLE public.post_comments ALTER COLUMN body DROP NOT NULL;

-- stories extras
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS music_name text;
ALTER TABLE public.stories ALTER COLUMN media_url DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.feed_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'mention',
  reference_id text,
  content text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.channel_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_subscriptions_unique UNIQUE (subscriber_user_id, channel_user_id),
  CONSTRAINT channel_subscriptions_no_self CHECK (subscriber_user_id <> channel_user_id)
);

CREATE TABLE IF NOT EXISTS public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, viewer_user_id)
);

CREATE TABLE IF NOT EXISTS public.story_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL DEFAULT 'love',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id, reaction_type)
);

CREATE TABLE IF NOT EXISTS public.tiktok_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL,
  video_id text NOT NULL,
  caption text,
  added_by text NOT NULL DEFAULT 'admin',
  category text NOT NULL DEFAULT 'mixed',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_views TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_reactions TO authenticated;
GRANT SELECT ON public.tiktok_videos TO authenticated;
GRANT ALL ON public.post_likes, public.comment_likes, public.feed_notifications, public.channel_subscriptions, public.story_views, public.story_reactions, public.tiktok_videos TO service_role;

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_likes_read ON public.post_likes;
CREATE POLICY post_likes_read ON public.post_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS post_likes_own ON public.post_likes;
CREATE POLICY post_likes_own ON public.post_likes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS comment_likes_read ON public.comment_likes;
CREATE POLICY comment_likes_read ON public.comment_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS comment_likes_own ON public.comment_likes;
CREATE POLICY comment_likes_own ON public.comment_likes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS feed_notifications_own ON public.feed_notifications;
CREATE POLICY feed_notifications_own ON public.feed_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS feed_notifications_update ON public.feed_notifications;
CREATE POLICY feed_notifications_update ON public.feed_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS feed_notifications_insert ON public.feed_notifications;
CREATE POLICY feed_notifications_insert ON public.feed_notifications FOR INSERT TO authenticated WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS channel_subs_read ON public.channel_subscriptions;
CREATE POLICY channel_subs_read ON public.channel_subscriptions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS channel_subs_own ON public.channel_subscriptions;
CREATE POLICY channel_subs_own ON public.channel_subscriptions FOR ALL TO authenticated USING (subscriber_user_id = auth.uid()) WITH CHECK (subscriber_user_id = auth.uid());

DROP POLICY IF EXISTS story_views_read ON public.story_views;
CREATE POLICY story_views_read ON public.story_views FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS story_views_own ON public.story_views;
CREATE POLICY story_views_own ON public.story_views FOR ALL TO authenticated USING (viewer_user_id = auth.uid()) WITH CHECK (viewer_user_id = auth.uid());

DROP POLICY IF EXISTS story_reactions_read ON public.story_reactions;
CREATE POLICY story_reactions_read ON public.story_reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS story_reactions_own ON public.story_reactions;
CREATE POLICY story_reactions_own ON public.story_reactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS tiktok_videos_read ON public.tiktok_videos;
CREATE POLICY tiktok_videos_read ON public.tiktok_videos FOR SELECT TO authenticated USING (is_active);

CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS post_comments_post_idx ON public.post_comments (post_id);
CREATE INDEX IF NOT EXISTS feed_notifications_user_idx ON public.feed_notifications (user_id, is_read);
