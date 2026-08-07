CREATE OR REPLACE FUNCTION public.enforce_slot_reset_request_safe_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR current_user LIKE 'service_role%'
     OR auth.role() = 'service_role'
  THEN
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

UPDATE public.slot_reset_requests AS r
SET status = 'approved',
    resolved_at = COALESCE(r.resolved_at, now())
WHERE r.id = 'edf50781-2c15-4eca-bc8d-b8c2c618fc6d'::uuid
  AND r.user_id = '4951d9e8-2c32-4834-a334-295ee01287a5'::uuid
  AND r.status = 'pending'
  AND NOT EXISTS (
    SELECT 1
    FROM public.tasks AS t
    WHERE t.user_id = r.user_id
      AND t.slot = ANY(r.slots)
      AND (
        t.status <> 'empty'::public.task_status
        OR t.wallet_address IS NOT NULL
        OR t.face_photo_url IS NOT NULL
      )
  );