# Good-App Play Store Publish Guide (PC ছাড়া)

## কি করা হয়েছে?

আপনার Lovable প্রজেক্টে এখন **Capacitor** সেটআপ করা আছে। এটা আপনার web app-কে Android app (APK/AAB) এ রূপান্তরিত করে।

## গুরুত্বপূর্ণ — Package Name

`capacitor.config.ts` ফাইলে `appId: 'com.goodapp.mobile'` দেওয়া আছে। Play Store-এ publish করার আগে এটা পরিবর্তন করুন (উদাহরণ: `com.yourcompany.goodapp`)। একবার publish করলে আর পরিবর্তন করা যায় না।

## উপায় ১: GitHub Actions দিয়ে Cloud Build (সবচেয়ে সহজ)

### Step 1: GitHub-এ project push করুন

Lovable-এ Git sync চালু করুন অথবা GitHub repository তৈরি করুন।

### Step 2: GitHub Actions চালান

1. GitHub repository-এ যান
2. **Actions** ট্যাবে ক্লিক করুন
3. **Build Android APK/AAB** workflow সিলেক্ট করুন
4. **Run workflow** → `apk-debug` সিলেক্ট করে চালান
5. কয়েক মিনিট পর **Artifacts** থেকে APK ডাউনলোড করুন

### Step 3: Release AAB বানান (Play Store-এর জন্য)

Play Store-এ AAB লাগবে, APK নয়। Release build করতে signing key লাগবে:

#### Signing Key তৈরি (একবারই করতে হবে)

Cloud-এ key তৈরি করতে GitHub Actions-এর `workflow_dispatch` ব্যবহার করুন অথবা নিচের কমান্ড GitHub Codespaces-এ চালান:

```bash
cd android
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias goodapp
```

তারপর `my-release-key.jks` ফাইলটিকে base64 এ কনভার্ট করুন:

```bash
base64 -w 0 android/app/my-release-key.jks
```

#### GitHub Secrets সেটআপ

GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

- `ANDROID_KEYSTORE_BASE64`: উপরের base64 string
- `ANDROID_KEYSTORE_PASSWORD`: আপনার দেওয়া password
- `ANDROID_KEY_ALIAS`: `goodapp`
- `ANDROID_KEY_PASSWORD`: key password

তারপর workflow চালান `aab-release` সিলেক্ট করে। Release AAB ডাউনলোড করুন।

## উপায় ২: GitHub Codespaces ব্যবহার করে (Browser-এ)

1. GitHub repository-এ যান
2. **Code** → **Codespaces** → **Create codespace on main**
3. Terminal-এ নিচের কমান্ড চালান:

```bash
bun install
bun run build
bun run cap:sync
cd android
./gradlew assembleDebug
```

APK ফাইল তৈরি হবে: `android/app/build/outputs/apk/debug/app-debug.apk`

## উপায় ৩: Ionic Appflow / Capgo (Paid but easiest)

- [Ionic Appflow](https://ionic.io/appflow): Directly cloud build করে Play Store-এ পাঠায়
- [Capgo](https://capgo.app): Capacitor-এর জন্য OTA update সহ cloud build

## Play Store-এ upload করার Steps

1. **Google Play Console** খুলুন ($25 one-time fee)
2. **Create app** → app name, language, category দিন
3. **App releases** → **Production** → **Create new release**
4. আপনার AAB ফাইল আপলোড করুন
5. **App signing**-এ Google-কে manage করতে দিন (recommended)
6. Store listing, screenshots, privacy policy দিন
7. **Review** → **Start rollout**

## প্রয়োজনীয় ফাইলসমূহ

- `capacitor.config.ts`: App name, package ID
- `android/`: Android native project
- `.github/workflows/build-android.yml`: Automatic cloud build
- `PLAYSTORE_SETUP.md`: এই গাইড

## সতর্কতা

- Capacitor শুধু mobile app build-এর জন্য। Lovable web preview/deploy এখনও আগের মতো কাজ করবে।
- Play Store publish করার আগে অবশ্যই package name পরিবর্তন করুন।
- Signing key হারিয়ে গেলে আর update দিতে পারবেন না — নিরাপদ জায়গায় রাখুন।
