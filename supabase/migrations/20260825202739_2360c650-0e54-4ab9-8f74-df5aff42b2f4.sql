ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS edited_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON public.posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_feed_notifications_user ON public.feed_notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_messages_pair ON public.friend_messages (sender_id, receiver_id, created_at DESC);