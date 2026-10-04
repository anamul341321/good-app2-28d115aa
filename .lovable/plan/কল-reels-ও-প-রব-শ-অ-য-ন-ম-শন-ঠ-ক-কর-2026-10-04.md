# কল, Reels ও প্রবেশ অ্যানিমেশন ঠিক করা

## যা বদলাব
- কল সেন্টারে ৯ চাপলে AI সহকারী চালু না করে সঙ্গে সঙ্গে মূল মেনুর কথাগুলো আবার বাজাব; স্ক্রিনের ৯ নম্বরের লেখাও “মূল মেনু” করব।
- ভারী পূর্ণ-স্ক্রিন ভিডিও সম্পূর্ণ সরিয়ে ছোট, দ্রুত GoodApp logo animation রাখব; admin, incoming call এবং call-accept entry-তে এটিও দেখাব না।
- নিজেরা আপলোড করা Reels-কে আগে দেখাব, প্রথম ভিডিও দ্রুত তৈরি করব, কাছের ভিডিও সীমিতভাবে preload করব এবং slow-network reload loop বাদ দেব।
- সাময়িক নেটওয়ার্ক বা token refresh সমস্যায় user-কে login থেকে বের করে না দিয়ে session ধরে রাখব; শুধু নিশ্চিত sign-out হলে বের করব।
- audio/video call ধরার আগেই প্রয়োজনীয় connection ও camera প্রস্তুত করব; পরিষ্কার 720p video, balanced bitrate এবং low-network fallback বজায় রাখব।

## পরীক্ষা
- মোবাইল মাপে ৯ → মূল মেনু, ছোট logo animation, Reels-এর প্রথম/পরের ভিডিও loading, এবং call entry-তে animation না আসা পরীক্ষা করব।
- build ও browser error দেখে কোনো নতুন সমস্যা থাকলে ঠিক করব।

## সীমা
- Internet speed ও দুই ফোনের camera quality-এর বাইরে সর্বোচ্চ পরিষ্কার/দ্রুত করা হবে; বাস্তব দুই-device call-এর চূড়ান্ত মান ফোনে পরীক্ষা করতে হবে।
