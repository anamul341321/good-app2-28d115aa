ALTER TABLE public.tg_bot_settings
  ADD COLUMN IF NOT EXISTS welcome_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_message text,
  ADD COLUMN IF NOT EXISTS default_video_url text,
  ADD COLUMN IF NOT EXISTS quote_reply boolean NOT NULL DEFAULT false;

UPDATE public.tg_bot_settings
SET default_video_url = COALESCE(default_video_url, 'https://youtu.be/gbUn9GdDvK8?si=Uu-6IXQSHpsGhiJG'),
    welcome_message = COALESCE(welcome_message, '🎉 স্বাগতম {name}! 💙

Good-App পরিবারে আপনাকে সাদরে আমন্ত্রণ 🤝

✅ এখানে ফেস ভেরিফিকেশন করে বোনাস ও মাইনিং ইনকাম করতে পারবেন।
📺 কিভাবে কাজ করে দেখে নিন: {video}

যেকোনো সমস্যা হলে এখানেই লিখুন — আমি সাথে সাথে সাহায্য করব 🙂')
WHERE id = 'default';