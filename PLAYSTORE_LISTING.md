# Good-App — Google Play listing ও declaration (Store build)

> এই নথি শুধু GitHub Actions-এর `store` build-এর জন্য। সাধারণ website/full APK বা GoodApp Call APK Play Console-এ দেবেন না।

App name: **Good-App**  
Package: **com.goodapp.mobile**  
Category: **Finance**  
Target audience: **18+**

## জরুরি URL

| বিষয় | URL |
|---|---|
| Privacy policy | https://goodapp2.live/privacy |
| Terms | https://goodapp2.live/terms |
| Data safety summary | https://goodapp2.live/data-safety |
| Account deletion | https://goodapp2.live/account-deletion |
| Support | support@goodapp2.live |

## Short description

```text
স্লট যাচাই, রিওয়ার্ড হিসাব, সেন্ড মানি, রিচার্জ ও স্থানীয় উইথড্র।
```

## Full description

```text
Good-App একটি একাউন্ট, স্লট যাচাই ও রিওয়ার্ড ব্যবস্থাপনা অ্যাপ। ব্যবহারকারী নিজের স্লট যাচাই ও রি-ভেরিফাই করতে, যোগ্য রিওয়ার্ডের হিসাব দেখতে, অন্য Good-App ব্যবহারকারীকে ব্যালান্স পাঠাতে, মোবাইল রিচার্জ করতে এবং বিকাশ বা নগদে উইথড্র অনুরোধ দিতে পারেন।

প্রধান সুবিধা
• স্লট ভেরিফাই ও রি-ভেরিফাই
• মেইন ও পেন্ডিং ব্যালান্সের পরিষ্কার হিসাব
• বিকাশ বা নগদে স্থানীয় উইথড্র অনুরোধ
• Good-App ব্যবহারকারীর মধ্যে সেন্ড মানি
• মোবাইল রিচার্জ
• রেফারেল ও চালু অফারের রিওয়ার্ড
• লেনদেনের ইতিহাস ও একাউন্ট নিরাপত্তা
• ঐচ্ছিক ফেস ভেরিফিকেশন ও বাধ্যতামূলক পাসওয়ার্ড

গুরুত্বপূর্ণ
Good-App কোনো ব্যাংক, ঋণ, বিনিয়োগ, সঞ্চয় বা ক্রিপ্টোকারেন্সি সেবা নয়। কোনো নির্দিষ্ট বা গ্যারান্টিড আয়ের প্রতিশ্রুতি দেওয়া হয় না। রিওয়ার্ডের যোগ্যতা, হার ও সময় অ্যাপে দেখানো নিয়ম এবং চালু অফারের উপর নির্ভর করে। Play Store সংস্করণে শুধু বিকাশ ও নগদ পেমেন্ট ব্যবহৃত হয়।
```

## App content declarations

| Play Console প্রশ্ন | সঠিক উত্তর |
|---|---|
| App category | **Finance** |
| Financial features | অ্যাপে যেগুলো বাস্তবে দেখায় সেগুলো সত্যভাবে ঘোষণা করুন: **Mobile payments / money transfer** এবং **Rewards**-এর উপযুক্ত অপশন |
| Cryptocurrency wallet / exchange / mining | **No** |
| Loans / credit / investment / insurance / banking | **No** |
| Gambling / real-money games | **No** |
| Ads | **No** |
| In-app purchases | **No** |
| User-generated public content | **No** |
| Target audience | **18+ only** |
| Account creation | **Yes** |
| Account deletion | **Yes — in app and web URL** |
| App access | **Login required; provide a working reviewer account** |

## Data safety form

| Data type | Collected | Shared | Purpose | Required |
|---|---|---|---|---|
| Name | Yes | No | Account management | Yes |
| Phone number | Yes | No | Login, account management, fraud prevention | Yes |
| Email | Yes | No | Security code and recovery | Optional |
| User IDs | Yes | No | Account and transaction functionality | Yes |
| Face photo / biometric-like verification image | Yes | No | Fraud prevention and account security | Optional |
| Profile photo, gender, country | Yes | No | Profile and regional settings | Optional |
| Payment information (bKash/Nagad number) | Yes | No | Withdrawal processing | Optional until withdrawal |
| Transaction history | Yes | No | App functionality, fraud prevention, accounting | Yes when used |
| Device/app information and login logs | Yes | No | Security and fraud prevention | Yes |

- Data encrypted in transit: **Yes**
- Users can request deletion: **Yes**
- Do not declare contacts, SMS, call logs, precise location, crypto wallet address, messages, posts, reels or advertising ID; Store build does not use them.

## App access for reviewer

```text
Login: (reviewer test mobile number)
Password: (reviewer test password)
Instructions: Sign in with the supplied account. Face verification is optional. The account must contain enough sample data to review slot status, balance, history, send money, recharge and withdrawal screens without making a real payment.
```

## Screenshots

Use only screenshots captured from a newly installed `store` build:

1. Home — slot/account summary
2. Slot verify or re-verify
3. Balance and history
4. Send money confirmation
5. Mobile recharge confirmation
6. Withdrawal showing only bKash/Nagad

Never upload a screenshot containing USDT, Celo, crypto, GoodApp Call download, admin panel, messenger, calls, feed, reels, “mining”, fixed-income claims or permanent commission claims.

## Build

GitHub Actions → **Build Android APK/AAB** → build type `aab-release` → build mode `store`.

Upload only the resulting **release-aab-store** artifact. Before production, install a `store` APK and check every screenshot and policy URL from that installed app.