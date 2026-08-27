create or replace function public.delete_expired_stories()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare _n integer;
begin
  with d as (delete from public.stories where expires_at <= now() returning 1)
  select count(*) into _n from d;
  delete from public.story_views sv where not exists (select 1 from public.stories s where s.id = sv.story_id);
  delete from public.story_reactions sr where not exists (select 1 from public.stories s where s.id = sr.story_id);
  return _n;
end;
$$;

select cron.unschedule('delete-expired-stories') where exists (select 1 from cron.job where jobname = 'delete-expired-stories');
select cron.schedule('delete-expired-stories', '*/15 * * * *', $$select public.delete_expired_stories();$$);