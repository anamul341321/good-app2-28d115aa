CREATE OR REPLACE FUNCTION public.protect_call_session_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.caller_id IS DISTINCT FROM OLD.caller_id
     OR NEW.callee_id IS DISTINCT FROM OLD.callee_id
     OR NEW.call_type IS DISTINCT FROM OLD.call_type
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Call identity cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_call_session_identity
BEFORE UPDATE ON public.call_sessions
FOR EACH ROW EXECUTE FUNCTION public.protect_call_session_identity();