-- Maintain posts.likes_count automatically from post_reactions (bypasses RLS issues)
CREATE OR REPLACE FUNCTION public.sync_post_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_post uuid;
BEGIN
  target_post := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE public.posts
  SET likes_count = (SELECT count(*) FROM public.post_reactions WHERE post_id = target_post)
  WHERE id = target_post;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_post_likes ON public.post_reactions;
CREATE TRIGGER trg_sync_post_likes
AFTER INSERT OR DELETE ON public.post_reactions
FOR EACH ROW EXECUTE FUNCTION public.sync_post_likes_count();

-- Backfill existing counts
UPDATE public.posts p
SET likes_count = (SELECT count(*) FROM public.post_reactions r WHERE r.post_id = p.id);