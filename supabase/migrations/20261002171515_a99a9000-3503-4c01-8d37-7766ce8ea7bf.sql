-- 1) auto_engage tables: admin-only read
drop policy if exists auto_engage_actions_read on public.auto_engage_actions;
drop policy if exists auto_engage_jobs_read on public.auto_engage_jobs;
create policy auto_engage_actions_admin_read on public.auto_engage_actions
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy auto_engage_jobs_admin_read on public.auto_engage_jobs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 2) channel_subscriptions: own rows only (own ALL policy already exists)
drop policy if exists channel_subs_read on public.channel_subscriptions;

-- 3) bonus_settings: admin-only read (server code uses service role, unaffected)
drop policy if exists "auth read bonus settings" on public.bonus_settings;
create policy bonus_settings_admin_read on public.bonus_settings
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 4) storage: app-releases download -> signed-in users only; upload -> admin only
drop policy if exists "Allow public downloads from app-releases" on storage.objects;
create policy "Authenticated downloads from app-releases" on storage.objects
  for select to authenticated using (bucket_id = 'app-releases');
drop policy if exists "Allow authenticated uploads to app-releases" on storage.objects;
create policy "Admin uploads to app-releases" on storage.objects
  for insert to authenticated with check (bucket_id = 'app-releases' and public.has_role(auth.uid(), 'admin'));

-- 5) storage: social_media uploads bound to uploader's own folder
drop policy if exists "Allow authenticated uploads" on storage.objects;
create policy "social_media owner uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'social_media' and (storage.foldername(name))[1] = (auth.uid())::text);