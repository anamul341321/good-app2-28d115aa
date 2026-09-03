alter table public.bonus_settings
  add column if not exists apk_lite_url text,
  add column if not exists apk_lite_version text,
  add column if not exists test_apk_lite_url text,
  add column if not exists test_apk_lite_version text;

comment on column public.bonus_settings.apk_lite_url is 'Play Store Lite build APK path/URL (financial features hidden)';
comment on column public.bonus_settings.apk_lite_version is 'Play Store Lite build version';
comment on column public.bonus_settings.test_apk_lite_url is 'Admin test Lite APK path/URL';
comment on column public.bonus_settings.test_apk_lite_version is 'Admin test Lite APK version';