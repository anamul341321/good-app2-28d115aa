# সব ফোনে ফিট কল স্ক্রিন, UID কল ও সহজ স্ক্রিন শেয়ার

## কী বদলাবে
- কল সেন্টারের পুরো পর্দা ফোনের উচ্চতা–প্রস্থ অনুযায়ী নিজে থেকে ছোট-বড় হবে; গুরুত্বপূর্ণ বোতাম স্ক্রল ছাড়াই দেখা যাবে।
- ডায়াল প্যাডে UID লিখে সেই ইউজারকে সরাসরি অডিও বা ভিডিও কল করা যাবে; ভুল UID হলে পরিষ্কার বার্তা দেখাবে।
- চলমান কলের স্ক্রিন শেয়ার বোতামে স্পষ্ট বাংলা লেখা থাকবে। এজেন্ট এক চাপেই ইউজারের কাছে অনুমতির অনুরোধ পাঠাতে পারবেন; ইউজার শুধু “অনুমতি দিন” চাপবেন।
- অ্যাডমিন বা এজেন্ট কল কাটলে realtime বার্তা না পৌঁছালেও সংরক্ষিত কল অবস্থার মাধ্যমে দ্রুত ইউজারের পাশেও কল বন্ধ হবে।
- কলের বড় পর্দা ও নিয়ন্ত্রণগুলো ছোট/লম্বা/চওড়া ফোনে পরীক্ষা করে overlap ও হারিয়ে যাওয়া বোতাম ঠিক করা হবে।

## Technical details
- বিদ্যমান CallProvider ব্যবহার করে UID lookup-এর ফল থেকে direct peer call শুরু হবে; existing authentication and call permissions preserved.
- Support-call hangup delivery will send realtime before channel removal, persist ended state, and keep the caller status fallback active.
- Viewport-safe sizing will use dynamic viewport height, safe-area spacing, compact breakpoints, and fixed control regions.

## যাচাই
- মোবাইলের কয়েকটি viewport-এ call center, incoming call এবং active call screen দেখা হবে।
- UID lookup, audio/video call start, screen-share request, user approval এবং দুই পাশের hangup path যাচাই হবে।
