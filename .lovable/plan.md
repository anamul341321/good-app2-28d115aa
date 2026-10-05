# Play Store policy cleanup

## লক্ষ্য
Google Play-এর `store` বিল্ডে USDT/Celo/ক্রিপ্টো, বাইরের APK, সোশ্যাল/কল এবং বিভ্রান্তিকর আয়ের দাবি যেন কোথাও দেখা বা ব্যবহার করা না যায়; ওয়েবসাইট ও GoodApp Call অপরিবর্তিত থাকবে।

## কাজ
- Store বিল্ডের উইথড্র, ওয়ালেট, ইতিহাস, দেশভিত্তিক রেট ও নীতিমালা থেকে USDT/Celo পুরোপুরি বাদ দেওয়া।
- শুধু পর্দায় লুকানো নয়: store বিল্ড থেকে ক্রিপ্টো অপশন বেছে পাঠানোও বন্ধ করা।
- Privacy Policy, Terms, Data Safety, Rules এবং Play Store listing-কে বর্তমান মূল অ্যাপের আসল সুবিধা ও permission-এর সঙ্গে মিলিয়ে লেখা।
- Store বিল্ডে পুরোনো “মাইনিং”, স্থায়ী আয়/কমিশন, সোশ্যাল/মেসেঞ্জার/কল এবং বাইরের APK সম্পর্কিত লেখা বা লিংক সরানো/নিরাপদ ভাষায় দেখানো।
- মোবাইল Store simulation, নিষিদ্ধ শব্দ scan এবং বর্তমান build error log দিয়ে ফল যাচাই করা।

## সীমা
- ওয়েবসাইটের USDT সুবিধা এবং আলাদা GoodApp Call অ্যাপ বদলানো হবে না।
- Google-এর অনুমোদন নিশ্চয়তা দেওয়া যায় না; তবে অ্যাপ, নীতিমালা ও listing-এর দৃশ্যমান অসঙ্গতি দূর করা হবে।

## Technical details
- `isStoreBuild()` দিয়ে UI guard-এর পাশাপাশি request validation ও route access শক্ত করা হবে।
- Store-safe policy text আলাদা helper দিয়ে render করা হবে, যাতে website copy অক্ষত থাকে।
