CREATE OR REPLACE FUNCTION public.enforce_slot_reset_request_safe_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'supabase_admin' OR current_user LIKE 'service_role%' THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only update your own slot reset request';
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.resolved_at IS DISTINCT FROM NEW.resolved_at
     OR OLD.user_id IS DISTINCT FROM NEW.user_id
     OR OLD.slots IS DISTINCT FROM NEW.slots
     OR OLD.requested_by IS DISTINCT FROM NEW.requested_by
     OR OLD.tg_chat_id IS DISTINCT FROM NEW.tg_chat_id
     OR OLD.tg_user_id IS DISTINCT FROM NEW.tg_user_id
     OR OLD.tg_message_id IS DISTINCT FROM NEW.tg_message_id
     OR OLD.note IS DISTINCT FROM NEW.note
  THEN
    RAISE EXCEPTION 'You are not allowed to change protected fields of a slot reset request';
  END IF;

  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'You can only edit a pending slot reset request';
  END IF;

  RETURN NEW;
END;
$$;