import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift, Globe2, Sparkles, X, ChevronRight } from "lucide-react";
import referGirl from "@/assets/refer-bonus-girl.jpg";
import { useLang } from "@/lib/i18n";
import { money } from "@/lib/money";

const DISMISS_KEY = "refer_bonus_fullscreen_dismissed";

/**
 * ফুল-স্ক্রিন রেফার বোনাস ব্যানার — অ্যাপে ঢুকলেই একবার (দিনে একবার) আসে।
 * ক্লিক করলে /rates পেজে যায়, যেখানে প্রতিটি দেশের রেট ও বোনাস দেখা যায়।
 */
export function ReferBonusBanner() {
  const { t, countryCode } = useLang();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DISMISS_KEY);
      if (saved === new Date().toDateString()) return;
    } catch { /* ignore */ }
    const id = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(id);
  }, []);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(DISMISS_KEY, new Date().toDateString()); } catch { /* ignore */ }
  };

  if (!open) return null;

  const bonus = money(150, countryCode).main;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#03150f]">
      <img
        src={referGirl}
        alt=""
        width={1024}
        height={1408}
        className="absolute inset-0 h-full w-full object-cover object-[68%_top]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#02100c] via-[#02100c]/85 to-[#02100c]/25" />

      <button
        onClick={close}
        aria-label={t("বন্ধ করুন", "Close")}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white/90 backdrop-blur"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative z-[1] mt-auto w-full space-y-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-300/40">
          <Sparkles className="h-3 w-3" /> {t("নতুন অফার", "New offer")}
        </div>

        <h2 className="text-[26px] font-black leading-tight text-white">
          {t("রেফার করলেই", "Refer a friend, get")}{" "}
          <span className="text-amber-300">{bonus}</span>{" "}
          {t("বোনাস!", "instantly!")}
        </h2>

        <p className="text-[13px] font-bold leading-relaxed text-emerald-100/90">
          {t(
            "বিদেশে থাকা বন্ধু-স্বজনকে রেফার করুন — সে একাউন্ট খুলে ভেরিফাই করলেই সাথে সাথে আপনার মেইন ব্যালেন্সে বোনাস। সাথে থাকছে পার্মানেন্ট ১০% রেফার কমিশন, আজীবন।",
            "Invite friends and family abroad — the moment they open and verify an account, the bonus lands in your main balance. Plus a permanent 10% referral commission, for life.",
          )}
        </p>

        <ul className="space-y-1 text-[11px] font-bold text-white/75">
          <li>• {t("প্রতিটি দেশের মাইনিং রেট আলাদা — ৪০০৳ থেকে ৬০০৳ পর্যন্ত", "Every country has its own mining rate — 400৳ to 600৳")}</li>
          <li>• {t("বাংলাদেশ থেকে বিদেশে রেফার করা সম্পূর্ণ বৈধ", "Referring people abroad from Bangladesh is fully allowed")}</li>
          <li>• {t("ইউজারকে আসলেই সেই দেশে থাকতে হবে — VPN দিয়ে হবে না", "The user must really be in that country — VPN will not work")}</li>
        </ul>

        <Link
          to="/rates"
          onClick={close}
          className="btn-press flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-500 to-amber-400 px-4 py-3.5 text-sm font-black text-[#04170f] shadow-2xl"
        >
          <span className="flex items-center gap-2">
            <Globe2 className="h-4 w-4" />
            {t("কোন দেশের কত রেট — সব দেখুন", "See every country's rate")}
          </span>
          <ChevronRight className="h-4 w-4" />
        </Link>

        <button
          onClick={close}
          className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-[12px] font-black text-white/85 backdrop-blur"
        >
          {t("পরে দেখব", "Maybe later")}
        </button>
      </div>
    </div>
  );
}

/** হোম পেজে ছোট কার্ড — সবসময় থাকবে, ক্লিক করলে রেট লিস্ট */
export function RatesEntryCard() {
  const { t, countryCode } = useLang();
  const bonus = money(150, countryCode).main;
  return (
    <Link
      to="/rates"
      className="btn-press flex items-center gap-3 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 to-amber-400/10 p-3.5"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/20">
        <Gift className="h-5 w-5 text-emerald-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black text-emerald-300">
          {t(`রেফার করলেই ${bonus} বোনাস`, `Refer & earn ${bonus}`)}
        </p>
        <p className="truncate text-[11px] font-bold text-muted-foreground">
          {t("কোন দেশের মাইনিং রেট কত — পতাকা সহ পুরো লিস্ট দেখুন", "Tap to see every country's mining rate & bonus")}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-emerald-400" />
    </Link>
  );
}
