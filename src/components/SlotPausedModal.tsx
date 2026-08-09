import { useEffect, useState } from "react";
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-amber/50 bg-gradient-to-b from-amber/15 via-surface-2 to-rose/10 p-5 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-400">
        <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full bg-amber/25 blur-3xl animate-pulse" />
        <div className="absolute -right-10 -bottom-10 h-28 w-28 rounded-full bg-rose/25 blur-3xl animate-pulse" />

        <button
          aria-label="বন্ধ করুন"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 z-10 rounded-lg bg-white/10 p-1.5 btn-press"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber/20 float-anim">
            <ShieldAlert className="h-8 w-8 text-amber animate-pulse" />
          </div>
          <h2 className="text-lg font-black text-amber leading-snug">
            স্লট ভেরিফিকেশন সাময়িকভাবে বন্ধ 🔧
          </h2>
          <p className="text-[12px] font-bold leading-relaxed text-muted-foreground">
            {message ||
              "আমাদের সার্ভারে কাজ চলছে, তাই নতুন করে কোনো স্লটে ফেস ভেরিফিকেশন আপাতত করা যাবে না। এটি সম্পূর্ণ সাময়িক — কাজ শেষ হলেই আবার স্বাভাবিকভাবে চালু হয়ে যাবে ইনশাআল্লাহ।"}
          </p>

          <div className="space-y-1.5 rounded-2xl border border-emerald/40 bg-emerald/10 p-3 text-left">
            <p className="flex items-center gap-1 text-[11px] font-black text-emerald">
              <CheckCircle2 className="h-3.5 w-3.5" /> পুরোনো ইউজারদের সব ঠিক থাকবে
            </p>
            <p className="text-[11px] font-bold leading-relaxed text-muted-foreground">
              • আগের ভেরিফাই করা স্লট আগের মতোই থাকবে<br />
              • মাইনিং স্বাভাবিকভাবে চলবে, টাকা যোগ হতেই থাকবে<br />
              • বোনাস, রেফার কমিশন ও ব্যালেন্স কোথাও কমবে না
            </p>
          </div>

          <div className="rounded-2xl border border-amber/40 bg-amber/10 p-3 text-left">
            <p className="flex items-center gap-1 text-[11px] font-black text-amber">
              <Clock className="h-3.5 w-3.5" /> আপাতত যা বন্ধ
            </p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-muted-foreground">
              শুধু নতুন স্লট ভেরিফাই ও রি-ভেরিফাই বন্ধ। রেজিস্ট্রেশন ও লগইন আগের মতোই চালু আছে।
            </p>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="gradient-cta w-full rounded-2xl px-4 py-3 text-sm font-black btn-press"
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> বুঝেছি, ধন্যবাদ
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
