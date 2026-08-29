# Good-App → Google Play Store (PC ছাড়া, ফোন দিয়েই)

শুরু থেকে শেষ পর্যন্ত ঠিক এই ক্রমে করুন। যেটা আমি করে দিয়েছি সেটা ✅ দিয়ে লেখা।

---

## ✅ আমি যা করে দিয়েছি (আপনার কিছু করতে হবে না)

- Capacitor সেটআপ (web app → Android app)
- App নাম **Good-App**, package `com.goodapp.mobile`
- আপনার লোগো দিয়ে সব সাইজের **app icon** বসানো
- App খুললেই সরাসরি live site `https://good-app2.lovable.app` লোড হয় — তাই সব ফিচার (mining, withdraw, KYC) কাজ করে
- **Privacy Policy** পেজ: `https://goodapp2.live/privacy` ← Play Store-এ এই লিংকটাই দিতে হবে
- **Terms** পেজ: `https://goodapp2.live/terms`
- **Child Safety Standards** পেজ: `https://goodapp2.live/child-safety` ← social/UGC অ্যাপের জন্য বাধ্যতামূলক
- Play Store-এর গ্রাফিক্স তৈরি: `app-icon-512.png` (512×512) আর `feature-graphic-1024x500.jpg` (1024×500) — Files প্যানেল থেকে ডাউনলোড করুন
- GitHub Actions cloud build workflow (PC/Android Studio লাগবে না)

---

## ধাপ ১ — Signing Key বানান (একবারই, খুব গুরুত্বপূর্ণ)

Play Store-এ app আপলোড করতে একটা "চাবি" (keystore) লাগে। এটা হারালে আর কখনো app আপডেট দিতে পারবেন না — তাই ফাইল ও পাসওয়ার্ড নিরাপদে রাখুন (Google Drive-এ কপি রাখুন)।

ফোন থেকেই GitHub Codespaces দিয়ে বানানো যায়:

1. GitHub-এ আপনার repository খুলুন → **Code** → **Codespaces** → **Create codespace on main**
2. নিচের terminal-এ লিখুন:

```bash
keytool -genkey -v -keystore goodapp.jks -keyalg RSA -keysize 2048 -validity 10000 -alias goodapp
```

3. পাসওয়ার্ড দিন (মনে রাখুন / লিখে রাখুন), নাম-দেশ ইত্যাদি চাইলে যেকিছু দিন, শেষে `yes` লিখুন।
4. এবার base64 কোড বের করুন:

```bash
base64 -w 0 goodapp.jks
```

5. যে লম্বা লেখাটা আসবে পুরোটা কপি করুন।
6. `goodapp.jks` ফাইলটা Codespaces থেকে ডাউনলোড করে নিজের Drive-এ সেভ রাখুন।

## ধাপ ২ — GitHub Secrets বসান

Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**। চারটি সিক্রেট বানান:

| নাম | মান |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | ধাপ ১-এর কপি করা লম্বা লেখা |
| `ANDROID_KEYSTORE_PASSWORD` | আপনার দেওয়া keystore পাসওয়ার্ড |
| `ANDROID_KEY_ALIAS` | `goodapp` |
| `ANDROID_KEY_PASSWORD` | key পাসওয়ার্ড (একই দিলে একই লিখুন) |

## ধাপ ৩ — AAB ফাইল বানান (Play Store-এ এটাই লাগে)

1. Repository → **Actions** ট্যাব
2. বাম দিকে **Build Android APK/AAB** সিলেক্ট করুন
3. **Run workflow** → build type: **`aab-release`** → **Run workflow**
4. ৫–১০ মিনিট অপেক্ষা করুন, সবুজ ✅ হলে ওই run-এ ঢুকে **Artifacts → release-aab** ডাউনলোড করুন
5. ভেতরে থাকবে `app-release.aab` — এটাই আপলোড করবেন

> আগে নিজে ফোনে টেস্ট করতে চাইলে একবার **`apk-debug`** দিয়ে run করুন, `app-debug.apk` ডাউনলোড করে ফোনে ইনস্টল করে দেখুন।

## ধাপ ৪ — Google Play Console একাউন্ট

1. https://play.google.com/console খুলুন, Gmail দিয়ে সাইন ইন
2. **$25 (এককালীন)** ফি কার্ড দিয়ে দিন
3. Identity verification: NID/পাসপোর্ট ও ঠিকানা দিন (২–৪৮ ঘণ্টায় approve হয়)
4. একাউন্ট টাইপ **Personal** নিলে সহজ

## ধাপ ৫ — App তৈরি ও তথ্য দেওয়া

**Create app** চাপুন:

- App name: `Good-App`
- Default language: বাংলা (বা English)
- App or game: **App**
- Free or paid: **Free**

এরপর বাঁ দিকের চেকলিস্ট ধরে ধরে পূরণ করুন:

**Store listing**
- Short description (৮০ অক্ষর): `ফেস ভেরিফাই করে মাইনিং, বোনাস ও সহজ উইথড্র — সবকিছু এক অ্যাপে।`
- Full description: অ্যাপের কাজ, ভেরিফিকেশন, বোনাস, রেফার ও উইথড্র নিয়ম লিখুন
- App icon: `app-icon-512.png`
- Feature graphic: `feature-graphic-1024x500.jpg`
- Phone screenshots: **কমপক্ষে ২টি** — ফোনে অ্যাপ খুলে হোম, wallet, withdraw, refer পেজের স্ক্রিনশট নিন

**App content** (এগুলো না দিলে রিভিউতে আটকাবে)
- Privacy policy URL: `https://goodapp2.live/privacy`
- Terms URL: `https://goodapp2.live/terms`
- Child safety standards URL: `https://goodapp2.live/child-safety`
- Data safety: ফর্মে সত্যি করে বলুন — নাম, ফোন নম্বর, ইমেইল, ছবি (ফেস) সংগ্রহ করা হয়; এনক্রিপ্টেড ট্রান্সফার; ব্যবহারকারী ডেটা মুছতে অনুরোধ করতে পারেন
- Ads: No ads
- Content rating: প্রশ্নপত্র পূরণ করুন
- Target audience: 18+
- Government apps / Financial features: **টাকা তোলার সুবিধা আছে** — এই প্রশ্নে সত্যি উত্তর দিন

## ধাপ ৬ — আপলোড ও রিলিজ

1. **Testing → Internal testing** এ প্রথমে `app-release.aab` আপলোড করুন, নিজের Gmail টেস্টার হিসেবে দিয়ে ফোনে ইনস্টল করে দেখুন সব ঠিক আছে কি না
2. সব ঠিক থাকলে **Production → Create new release** → একই AAB আপলোড
3. Release name: `1.0`, release notes: `প্রথম রিলিজ`
4. **App signing**: Google-কে manage করতে দিন (recommended)
5. **Send for review** → **Start rollout to Production**

রিভিউতে সাধারণত **১–৭ দিন** লাগে। Approve হলে Play Store-এ লিংক পাবেন।

## ধাপ ৭ — পরে আপডেট দিতে

আপডেট দিতে হলে `android/app/build.gradle`-এ `versionCode 1` → `2` এবং `versionName "1.0"` → `"1.1"` করুন, তারপর ধাপ ৩ ও ৬ আবার করুন। (বললেই আমি বাড়িয়ে দেব।)

---

## রিজেক্ট এড়াতে ৫টি সতর্কতা

1. Privacy policy লিংক অবশ্যই কাজ করতে হবে — `https://goodapp2.live/privacy`
2. Data safety ফর্মে ফেস/ছবি সংগ্রহের কথা **অবশ্যই** লিখতে হবে, লুকালে রিজেক্ট
3. "গ্যারান্টিড ইনকাম", "টাকা দ্বিগুণ" ধরনের কথা description-এ লিখবেন না
4. Screenshot অ্যাপের আসল স্ক্রিন হতে হবে, নকল ডিজাইন নয়
5. Keystore ফাইল ও পাসওয়ার্ড কখনোই হারাবেন না
