import { useState } from "react";
import { ShieldCheck, Camera, ImagePlus, X, Check } from "lucide-react";

/**
 * Explicit consent screen shown before the first face capture.
 * Required by Play Store data-policy rules for collecting biometric/face data.
 */
export function FaceConsentModal({
  onAgree,
  onDecline,
}: {
  onAgree: () => void;
  onDecline: () => void;
}) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-emerald/15 items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-emerald" />
          </div>
          <h2 className="text-lg font-black text-navy">ফেস ভেরিফিকেশনের অনুমতি</h2>
          <p className="text-[11px] text-muted-foreground">
            আপনার পরিচয় নিরাপত্তার জন্য আমরা একটি ছবি সংগ্রহ করব।
          </p>
        </div>

        <ul className="space-y-2 text-[11px] text-muted-foreground font-bold">
          <li className="flex gap-2">
            <Camera className="w-4 h-4 text-cyan shrink-0" />
            <span>আপনি চাইলে ক্যামেরা দিয়ে ছবি তুলতে পারবেন বা গ্যালারি থেকে আপলোড করতে পারবেন।</span>
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald shrink-0" />
            <span>ছবি শুধু আপনি প্রকৃত মানুষ কি না তা যাচাই করতে ব্যবহার করা হবে।</span>
          </li>
          <li className="flex gap-2">
            <ImagePlus className="w-4 h-4 text-violet shrink-0" />
            <span>ছবি এনক্রিপ্টেড HTTPS-এ সংরক্ষিত এবং কখনো বিক্রি/শেয়ার করা হয় না।</span>
          </li>
        </ul>

        <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-xl border border-border p-3">
          <span
            className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
              accepted ? "bg-emerald border-emerald" : "border-border bg-white"
            }`}
            onClick={() => setAccepted((v) => !v)}
          >
            {accepted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
          </span>
          <span
            className="text-[11px] text-navy font-bold leading-snug"
            onClick={() => setAccepted((v) => !v)}
          >
            আমি উপরের শর্তগুলো পড়েছি এবং ফেস ভেরিফিকেশনের জন্য ছবি দিতে সম্মত।
          </span>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onDecline}
            className="py-3 rounded-xl border border-border bg-surface-2 text-navy font-bold text-sm flex items-center justify-center gap-1 btn-press"
          >
            <X className="w-4 h-4" /> এখন না
          </button>
          <button
            onClick={onAgree}
            disabled={!accepted}
            className="py-3 rounded-xl gradient-emerald text-white font-black text-sm flex items-center justify-center gap-1 disabled:opacity-50 btn-press"
          >
            <Check className="w-4 h-4" /> সম্মত
          </button>
        </div>
      </div>
    </div>
  );
}
