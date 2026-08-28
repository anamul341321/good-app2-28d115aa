REVOKE EXECUTE ON FUNCTION public.award_coin_event(UUID, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_watch_coins(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_coin_summary(UUID) FROM anon;

CREATE OR REPLACE FUNCTION public.assert_coin_self(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END;
$$;