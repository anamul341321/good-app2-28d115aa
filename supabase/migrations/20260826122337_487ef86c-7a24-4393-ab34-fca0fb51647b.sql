CREATE OR REPLACE FUNCTION public.notify_push_on_feed_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://project--9faa7771-af86-4101-8cf2-0ed6dd381713.lovable.app/api/public/push/feed-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_4DyP1XkSPdRbBr04bFefRw_nqpGiHOR'
    ),
    body := jsonb_build_object('id', NEW.id),
    timeout_milliseconds := 8000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_on_feed_notification ON public.feed_notifications;
CREATE TRIGGER trg_notify_push_on_feed_notification
AFTER INSERT ON public.feed_notifications
FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_feed_notification();