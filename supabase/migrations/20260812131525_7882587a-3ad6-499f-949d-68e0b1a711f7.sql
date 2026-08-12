CREATE OR REPLACE FUNCTION public.notify_push_on_notice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://project--9faa7771-af86-4101-8cf2-0ed6dd381713.lovable.app/api/public/push/notice',
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

DROP TRIGGER IF EXISTS trg_notify_push_on_notice ON public.user_notices;
CREATE TRIGGER trg_notify_push_on_notice
AFTER INSERT ON public.user_notices
FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_notice();