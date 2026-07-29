ALTER TABLE public.tg_faq ADD COLUMN IF NOT EXISTS image_path text;
ALTER TABLE public.tg_bot_settings ADD COLUMN IF NOT EXISTS uid_lookup_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.tg_bot_settings ADD COLUMN IF NOT EXISTS ask_uid_message text NOT NULL DEFAULT 'আপনার Good-App UID টি এখানে লিখুন (যেমন: 4100), আমি সাথে সাথে আপনার একাউন্টের হিসাব দেখে দিচ্ছি।';