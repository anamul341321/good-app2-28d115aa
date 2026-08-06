import { Info } from "lucide-react";

/**
 * Play Store / policy friendly disclaimer shown on the home dashboard.
 * Avoids any impression of "guaranteed income" and links to Terms & Privacy.
 */
export function ComplianceDisclaimer() {
  return (
    <div className="rounded-2xl border border-amber/40 bg-amber/10 p-3 flex gap-3 items-start">
      <Info className="w-4 h-4 text-amber shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-[11px] font-black text-navy leading-snug">
          রিওয়ার্ড নির্ভরশীল
        </p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Good-App-এ পাওয়া বোনাস/রিওয়ার্ড অ্যাপের নিয়ম, সক্রিয় স্লট, রেফারেল কার্যকলাপ এবং প্রচলিত তহবিলের উপর নির্ভরশীল।
          এটি কোনো "গ্যারান্টিড ইনকাম", বিনিয়োগ বা চাকরি নয়। উইথড্র নিয়ম ও শর্তাবলি প্রযোজ্য।
        </p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          ফেস ভেরিফিকেশন সম্পূর্ণ ঐচ্ছিক — শুধু আপনি প্রকৃত ব্যবহারকারী কি না তা যাচাই করতেই ছবি ব্যবহার করা হয়।
          ছবি এনক্রিপ্টেড সংযোগে সংরক্ষিত এবং কখনো তৃতীয় পক্ষের কাছে বিক্রি করা হয় না।
        </p>
      </div>
    </div>
  );
}
