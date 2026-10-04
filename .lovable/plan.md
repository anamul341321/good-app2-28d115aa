# কল সেন্টার → অ্যাডমিন প্যানেলে সরাসরি ভয়েস কল

## কী হবে
- কল সেন্টারে ০ চাপলে (বা "কাস্টমার কেয়ারে কথা বলুন") ইউজারের ফোন থেকে অ্যাপের ভেতর দিয়েই ভয়েস কল যাবে — কোনো ফোন নম্বর বা টাকা লাগবে না।
- লগইন না থাকলেও কল করা যাবে (নাম/ফোন নম্বর ঐচ্ছিক ভাবে চাওয়া হবে, লগইন থাকলে UID নিজে থেকে যাবে)।
- অ্যাডমিন প্যানেলে নতুন "ইনকামিং কল" পেজ: রিং বাজবে, ইউজারের UID/নাম দেখাবে, "ধরুন" / "কেটে দিন" বোতাম।
- কল চলাকালীন টাইমার, মিউট, কল কাটা; কল লগ থাকবে (কে, কখন, কত মিনিট, ধরা হয়েছে কি না)।
- কেউ না ধরলে ৪৫ সেকেন্ড পর ইউজারকে বলবে "এখন সব এজেন্ট ব্যস্ত, পরে চেষ্টা করুন বা টেলিগ্রামে লিখুন"।
- কল সেন্টার পেজ লগইন ছাড়াও খোলা যাবে।

## জরুরি সীমাবদ্ধতা
- কল তখনই রিং হবে যখন অ্যাডমিন প্যানেল কোনো ফোন/কম্পিউটারে খোলা থাকবে। প্যানেল বন্ধ থাকলে টেলিগ্রামে সাথে সাথে নোটিশ যাবে "মিসড কল — UID ...", যাতে আপনি পরে যোগাযোগ করতে পারেন।
- খুব দুর্বল নেটে কথা কেটে যেতে পারে।

## Technical details
- WebRTC peer-to-peer audio (Google public STUN); signaling via backend realtime channel.
- New table `support_calls` (id, caller user_id nullable, caller name/phone, status ringing/accepted/ended/missed, timestamps) + `support_call_signals` (offer/answer/ICE). Guest callers write via public server functions with a random call token; admin reads/answers via role check (`has_role` admin).
- Move call-center page to a public route `/callcenter`; keep old link working.
- Admin route `/admin/calls` with ringtone, accept/decline, call log.
- Missed-call Telegram alert to owner via existing bot.
