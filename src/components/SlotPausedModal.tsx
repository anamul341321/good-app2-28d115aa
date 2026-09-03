import { useEffect, useState } from "react";
import { isLiteBuild } from "@/lib/lite-build";
import { ShieldAlert, Sparkles, Clock, X, CheckCircle2 } from "lucide-react";

const KEY = "slot_paused_notice_seen_at";

/**
 * অ্যাপে ঢুকলেই একবার দেখানো সুন্দর অ্যানিমেটেড নোটিশ —
 * "স্লট ভেরিফিকেশন সাময়িকভাবে বন্ধ", পুরোনো ইউজারদের মাইনিং স্বাভাবিক।
 */
export function SlotPausedModal({ message }: { message?: string | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem(KEY) || "0");
      if (Date.now() - last > 6 * 60 * 60 * 1000) {
        setOpen(true);
        sessionStorage.setItem(KEY, String(Date.now()));
      }
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 bg-black/80 animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-amber bg-surface p-6 shadow-[0_0_60px_-12px_rgba(245,158,11,0.45)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-400">
        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-amber/40 blur-2xl animate-pulse" />
        <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-rose/40 blur-2xl animate-pulse" />

        <button
          aria-label="বন্ধ করুন"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 z-10 rounded-lg bg-muted p-1.5 text-foreground btn-press"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative space-y-4 text-center">
          <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-2xl bg-amber/20 float-anim ring-2 ring-amber/40">
            <ShieldAlert className="h-9 w-9 text-amber animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-amber leading-tight drop-shadow-sm">
            স্লট ভেরিফিকেশন সাময়িকভাবে বন্ধ 🔧
          </h2>
          <p className="text-[14px] font-bold leading-relaxed text-foreground">
            {message ||
              "আমাদের সার্ভারে কাজ চলছে, তাই নতুন করে কোনো স্লটে ফেস ভেরিফিকেশন আপাতত করা যাবে না। এটি সম্পূর্ণ সাময়িক — কাজ শেষ হলেই আবার স্বাভাবিকভাবে চালু হয়ে যাবে ইনশাআল্লাহ।"}
          </p>

          <div className="space-y-2 rounded-2xl border border-emerald bg-emerald/10 p-4 text-left">
            <p className="flex items-center gap-2 text-[13px] font-black text-emerald">
              <CheckCircle2 className="h-4 w-4" /> পুরোনো ইউজারদের সব ঠিক থাকবে
            </p>
            <p className="text-[13px] font-bold leading-relaxed text-foreground">
              • আগের ভেরিফাই করা স্লট আগের মতোই থাকবে<br />
              {isLiteBuild() ? (
                <>
                  • আপনার প্রোফাইল ও পরিচয় তথ্য আগের মতোই থাকবে<br />
                  • মেসেঞ্জার, রিলস ও অন্য সব ফিচার স্বাভাবিকভাবে চলবে
                </>
              ) : (
                <>
                  • মাইনিং স্বাভাবিকভাবে চলবে, টাকা যোগ হতেই থাকবে<br />
                  • বোনাস, রেফার কমিশন ও ব্যালেন্স কোথাও কমবে না
                </>
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-amber bg-amber/10 p-4 text-left">
            <p className="flex items-center gap-2 text-[13px] font-black text-amber">
              <Clock className="h-4 w-4" /> আপাতত যা বন্ধ
            </p>
            <p className="mt-1 text-[13px] font-bold leading-relaxed text-foreground">
              • First Verify সাময়িকভাবে বন্ধ<br />
              • Re-verify সাময়িকভাবে বন্ধ<br />
               {!isLiteBuild() && <>• তাই নতুন বোনাস অফারও আপাতত দেখানো হচ্ছে না<br /></>}
              • রেজিস্ট্রেশন ও লগইন আগের মতোই চালু আছে
            </p>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="gradient-cta w-full rounded-2xl px-4 py-3.5 text-[15px] font-black btn-press"
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> বুঝেছি, ধন্যবাদ
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
