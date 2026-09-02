-- lovable-cron-fallback-reviewed: 96 runs/day; gradual human-like drip of likes/comments across days requires frequent small batches; hourly batches would jump visibly
create table if not exists public.auto_engage_jobs (
  post_id uuid primary key references public.posts(id) on delete cascade,
  owner_id uuid not null,
  sentiment text not null default 'general',
  target_likes int not null default 3000,
  likes_done int not null default 0,
  comments_done int not null default 0,
  quality numeric not null default 1,
  finished boolean not null default false,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.auto_engage_actions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists auto_engage_actions_post_idx on public.auto_engage_actions(post_id, action);
create index if not exists auto_engage_jobs_pending_idx on public.auto_engage_jobs(finished, last_run_at);

grant select on public.auto_engage_jobs to authenticated;
grant all on public.auto_engage_jobs to service_role;
grant select on public.auto_engage_actions to authenticated;
grant all on public.auto_engage_actions to service_role;

alter table public.auto_engage_jobs enable row level security;
alter table public.auto_engage_actions enable row level security;

drop policy if exists "auto_engage_jobs_read" on public.auto_engage_jobs;
create policy "auto_engage_jobs_read" on public.auto_engage_jobs for select to authenticated using (true);
drop policy if exists "auto_engage_actions_read" on public.auto_engage_actions;
create policy "auto_engage_actions_read" on public.auto_engage_actions for select to authenticated using (true);

create or replace function public.auto_engage_enqueue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auto_engage_jobs (post_id, owner_id)
  values (new.id, new.user_id)
  on conflict (post_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_posts_auto_engage on public.posts;
create trigger trg_posts_auto_engage
after insert on public.posts
for each row execute function public.auto_engage_enqueue();

create or replace function public.auto_engage_pick_users(p_post_id uuid, p_limit int, p_action text)
returns table(user_id uuid)
language sql
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.id <> (select owner_id from public.auto_engage_jobs j where j.post_id = p_post_id)
    and not exists (
      select 1 from public.auto_engage_actions a
      where a.post_id = p_post_id and a.user_id = p.id and a.action = p_action
    )
    and not exists (
      select 1 from public.post_reactions r
      where r.post_id = p_post_id and r.user_id = p.id
    )
  order by random()
  limit greatest(p_limit, 0)
$$;

insert into public.auto_engage_jobs (post_id, owner_id, created_at)
select p.id, p.user_id, p.created_at
from public.posts p
left join public.auto_engage_jobs j on j.post_id = p.id
where j.post_id is null and p.created_at > now() - interval '14 days'
on conflict (post_id) do nothing;

do $$
declare existing_job record;
begin
  for existing_job in select jobid from cron.job where jobname = 'auto-engage-every-10min' loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
  for existing_job in select jobid from cron.job where jobname = 'auto-engage-every-15min' loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end $$;

select cron.schedule(
  'auto-engage-every-15min',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://www.goodapp2.live/api/public/auto-engage/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'whitelist_cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 50000
  ) as request_id;
  $cron$
);