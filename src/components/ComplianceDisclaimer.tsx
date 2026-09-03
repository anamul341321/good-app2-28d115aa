import { Info } from "lucide-react";
import { isLiteBuild } from "@/lib/lite-build";

/**
 * Policy friendly disclaimer shown on the home dashboard.
 * In the Play Store build it only explains that features are free and that
 * face verification is optional — no money / payout wording at all.
 */
export function ComplianceDisclaimer() {
  const lite = isLiteBuild();

  return (
    <div className="rounded-2xl border border-amber/40 bg-amber/10 p-3 flex gap-3 items-start">
      <Info className="w-4 h-4 text-amber shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-[11px] font-black text-navy leading-snug">
          {lite ? "ফিচার ব্যবহারের নিয়ম" : "রিওয়ার্ড নির্ভরশীল"}
        </p>
        {!lite && (
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Good-App-এ পাওয়া বোনাস/রিওয়ার্ড অ্যাপের নিয়ম, সক্রিয় স্লট, রেফারেল কার্যকলাপ এবং প্রচলিত তহবিলের উপর নির্ভরশীল।
            এটি কোনো "গ্যারান্টিড ইনকাম", বিনিয়োগ বা চাকরি নয়। উইথড্র নিয়ম ও শর্তাবলি প্রযোজ্য।
          </p>
        )}
        {lite && (
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            এই অ্যাপের মেসেঞ্জার, রিলস, স্টোরি ও প্রোফাইল ফিচার সম্পূর্ণ ফ্রি। নিয়ম ভাঙলে বা ফেক প্রোফাইল/হ্যারাসমেন্ট পাওয়া গেলে একাউন্টে সীমাবদ্ধতা আসতে পারে।
          </p>
        )}
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          ফেস ভেরিফিকেশন সম্পূর্ণ ঐচ্ছিক — শুধু আপনি প্রকৃত ব্যবহারকারী কি না তা যাচাই করতেই ছবি ব্যবহার করা হয়।
          ছবি এনক্রিপ্টেড সংযোগে সংরক্ষিত এবং কখনো তৃতীয় পক্ষের কাছে বিক্রি করা হয় না।
        </p>
        {lite && (
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            কেন মাঝে মাঝে আবার ছবি চাওয়া হয়? এটি একটি ঐচ্ছিক নিরাপত্তা ধাপ — ডুপ্লিকেট/ফেক অ্যাকাউন্ট, বট, স্প্যাম ও
            অ্যাকাউন্ট চুরি ঠেকাতে এবং কমিউনিটিতে প্রকৃত মানুষ নিশ্চিত করতে। ছবি না দিলেও মেসেঞ্জার, রিলস, স্টোরি সবই ব্যবহার করা যায়;
            ছবি যেকোনো সময় সেটিংস থেকে মুছে ফেলা যায়।
          </p>
        )}

      </div>
    </div>
  );
}

