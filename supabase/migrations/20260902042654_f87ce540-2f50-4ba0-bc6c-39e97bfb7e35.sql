revoke all on function public.auto_engage_pick_users(uuid, int, text) from public, anon, authenticated;
grant execute on function public.auto_engage_pick_users(uuid, int, text) to service_role;
revoke all on function public.auto_engage_enqueue() from public, anon, authenticated;