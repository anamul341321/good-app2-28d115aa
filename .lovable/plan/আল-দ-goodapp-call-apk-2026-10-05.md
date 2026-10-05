# আলাদা "GoodApp Call" APK

## যা পাবেন
- ফোনে আলাদা একটি app: **GoodApp Call** (নিজস্ব আইকন), মূল GoodApp-এর পাশাপাশি install করা যাবে।
- খুললেই সরাসরি কল পাতা: dial pad, UID দিয়ে কল, recent/saved, messenger, কল সাপোর্ট। পুরো app-এর loading বা logo animation থাকবে না।
- একই account দিয়ে login — balance/messenger সব একই থাকবে।
- কল এলে ফোন বন্ধ/app বন্ধ থাকলেও পুরো স্ক্রিনে রিং (WhatsApp-এর মতো), "ধরুন / কাটুন" বোতাম। ধরলে app না খুলে সরাসরি কথা শুরু।
- মূল GoodApp-এও একই দ্রুত রিং/ধরা ব্যবস্থা।
- ডাউনলোড: GitHub থেকে আগের মতো APK বানানো যাবে, শুধু "calls" অপশন বাছতে হবে; app-এর ভেতরে "কল অ্যাপ ডাউনলোড" বোতাম।

## কেন দ্রুত হবে
- কল পাতাটা app-এর ভেতরেই রাখা (internet থেকে পুরো সাইট load হবে না)।
- ফোনের নিজস্ব কল-স্ক্রিন ব্যবহার, তাই app খোলার অপেক্ষা নেই।
- কল আসার আগেই connection প্রস্তুত রাখা।

## আপনার কাছ থেকে যা লাগবে
- Firebase (Google) project-এর `google-services.json` ফাইল ও server key — app বন্ধ অবস্থায় রিং পাঠাতে এটা লাগে। ধাপগুলো আমি সহজ বাংলায় লিখে দেব।

## Technical details
- Android `productFlavors`: `full` (com.goodapp.mobile) ও `calls` (com.goodapp.calls), আলাদা নাম/আইকন।
- `calls` flavor: Capacitor bundled `dist/client` (no server.url), start route `/calls`, splash skip।
- Native: `@capacitor-firebase/messaging` data-only FCM push + custom ConnectionService/full-screen-intent notification (CallStyle) with answer/decline actions → deep-link `/calls?answer=<sessionId>`; pre-warm RTCPeerConnection + TURN on push receipt।
- Server: on `call_sessions` insert, server fn sends FCM to callee device tokens (`device_push_tokens` table, self-only RLS + grants)।
- Workflow `build-android.yml`: new `build_mode=calls`, artifact `GoodApp-Call.apk`।
- Limit: ফোনের battery saver কিছু ব্র্যান্ডে রিং দেরি করাতে পারে; settings-এ "battery restriction বন্ধ" নির্দেশনা দেখানো হবে।
