create table if not exists public.reverify_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot integer not null,
  due_at timestamptz not null,
  window_label text not null,
  sent_at timestamptz not null default now(),
  unique (task_id, window_label)
);

grant select, insert, update, delete on public.reverify_reminders to authenticated;
grant all on public.reverify_reminders to service_role;

alter table public.reverify_reminders enable row level security;

create policy "Users can see own reminders" on public.reverify_reminders
  for select to authenticated using (user_id = auth.uid());

create policy "Service role can manage reminders" on public.reverify_reminders
  for all to service_role using (true) with check (true);
