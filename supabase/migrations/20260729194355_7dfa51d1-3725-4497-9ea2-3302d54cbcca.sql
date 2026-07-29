UPDATE public.tg_bot_settings
SET ask_slot_message = 'কোন কোন স্লট রিসেট করতে চান? স্লট নম্বর লিখুন — একটি (যেমন: 23), একাধিক (2,5,7), রেঞ্জ (২-৬) অথবা সবগুলোর জন্য লিখুন "সব"।',
    ask_uid_message = 'আপনার Good-App UID টি লিখুন (যেমন: 4100) — সাথে সাথে আপনার একাউন্টের পুরো হিসাব দেখে দিচ্ছি 🙂',
    updated_at = now()
WHERE id = 'default';