import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getDashboard, getMyWithdrawals } from "@/lib/dashboard.functions";
import { requestWithdraw } from "@/lib/withdraw.functions";
import { withdrawPayout, MIN_WITHDRAW_BDT, withdrawFee } from "@/lib/constants";
import { computeLiveBalance, splitBalance } from "@/lib/mining";
import { useState, useEffect } from "react";
import { ArrowDownToLine, Loader2, Lock, Copy, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageVoice } from "@/components/PageVoice";
import bkashLogo from "@/assets/bkash-logo.png";
import nagadLogo from "@/assets/nagad-logo.png";
import usdtLogo from "@/assets/usdt-logo.png";
import { useLang } from "@/lib/i18n";
import { withdrawWindowInfo, withdrawCountdownInfo } from "@/lib/withdraw-window";
import { WithdrawClosedBanner } from "@/components/WithdrawClosedBanner";
import { WithdrawCountdown } from "@/components/WithdrawCountdown";
import { getAdBoostStatus } from "@/lib/ads.functions";
import { WithdrawRejectDetails } from "@/components/WithdrawRejectDetails";



export const Route = createFileRoute("/_authenticated/withdraw")({ component: WithdrawPage });

function WithdrawPage() {
  const { t } = useLang();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["withdrawals"], queryFn: () => getMyWithdrawals(),
  });

  const { data: adBoost } = useQuery({ queryKey: ["ad-boost"], queryFn: () => getAdBoostStatus() });

  const walletBkash = (data as any)?.walletBkash ?? null;
  const walletNagad = (data as any)?.walletNagad ?? null;
  const payout = (data as any)?.payoutSettings ?? { bkashEnabled: true, nagadEnabled: true };

  // Pick the first usable provider by default
  const initial: "bkash" | "nagad" | null =
    (payout.bkashEnabled && walletBkash) ? "bkash" :
    (payout.nagadEnabled && walletNagad) ? "nagad" :
    walletBkash ? "bkash" :
    walletNagad ? "nagad" : null;

  const [provider, setProvider] = useState<"bkash" | "nagad" | null>(initial);
  useEffect(() => { if (!provider && initial) setProvider(initial); }, [initial, provider]);

  const [mode, setMode] = useState<"bdt" | "usdt">("bdt");
  const [usdtAddress, setUsdtAddress] = useState<string>("");
  const [historyTab, setHistoryTab] = useState<"bdt" | "usdt">("bdt");
  const usdtRate = Number((data as any)?.payoutSettings?.usdtRateBdt ?? 130);
  const usdtEnabled = (data as any)?.payoutSettings?.usdtEnabled !== false;
  const usdtOffMsg = (data as any)?.payoutSettings?.usdtOffMessage;

  const [amount, setAmount] = useState<string>("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const mut = useMutation({
    mutationFn: () => requestWithdraw({
      data: {
        amount: Math.floor(Number(amount) || 0),
        provider: mode === "usdt" ? "usdt" : (provider ?? undefined),
        usdtAddress: mode === "usdt" ? usdtAddress.trim() : undefined,
      },
    }),
    onSuccess: () => {
      toast.success(t("উইথড্র রিকোয়েস্ট পাঠানো হয়েছে! অ্যাডমিন শীঘ্রই প্রসেস করবেন।", "Withdraw request submitted! The admin will process it soon."));
      setAmount(""); setUsdtAddress("");
      refetch(); refetchHistory();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan" /></div>;

  const mining = data?.mining;
  const debts = (data as any)?.debts ?? [];
  const debtTotal = Number((data as any)?.debtTotal ?? 0);
  const balance = mining ? computeLiveBalance({
    accrued: Number(mining.accrued_amount), withdrawn: Number(mining.withdrawn_amount),
    isActive: mining.is_active, lastCreditedAt: mining.last_credited_at,
    effectiveTaskCount: Number((mining as any).effective_task_count ?? 0),
    qualifyingReferees: Number((mining as any).qualifying_referees ?? 0),
    selfSlots: Number((mining as any).self_slots ?? 0),
    referralUnits: Number((mining as any).referral_units ?? 0),
    selfQualified: (mining as any).self_qualified !== false,
    debt: debtTotal,
    now,
  }) : 0;

  const breakdown = (data as any).balanceBreakdown || { current_balance: 0, bonus_part: 0, mining_part: 0, mining_available: 0, mining_locked: 0 };
  const bonusAvailable = Math.floor(breakdown.bonus_part);
  const miningPart = Math.floor(breakdown.mining_part);
  const miningAvailable = Math.floor(breakdown.mining_available ?? breakdown.mining_part ?? 0);
  // শুধু মেইন ব্যালেন্স উইথড্র করা যাবে — মাইনিং ব্যালেন্স আগে মেইনে ক্লেইম করতে হবে।
  const miningLockedAmount = miningPart;
  const claimable = bonusAvailable;
  const miningLocked = miningLockedAmount > 0;

  const chosenWallet = provider === "bkash" ? walletBkash : provider === "nagad" ? walletNagad : null;
  const chosenEnabled = provider === "bkash" ? payout.bkashEnabled : provider === "nagad" ? payout.nagadEnabled : false;
  const chosenOffMsg  = provider === "bkash" ? payout.bkashOffMessage : payout.nagadOffMessage;

  const adminWithdrawOff = (data as any)?.payoutSettings?.withdrawEnabled === false;
  const monthlyWindow = withdrawCountdownInfo(now);
  const withdrawClosed = withdrawWindowInfo(now).isClosed || adminWithdrawOff || !monthlyWindow.isOpen;

  return (
    <div className="space-y-4 pt-2">
      <PageVoice pageId="withdraw" steps={["withdraw.intro","withdraw.amount","withdraw.submit"]} />
      <div className="text-center">
        <ArrowDownToLine className="w-8 h-8 text-rose mx-auto" />
        <h1 className="text-2xl font-black mt-1">{t("উইথড্র", "Withdraw")}</h1>
      </div>

      <RegionPayoutNote />

      <WithdrawCountdown />

      <WithdrawClosedBanner
        adminOff={adminWithdrawOff}
        adminMessage={(data as any)?.payoutSettings?.withdrawOffMessage}
      />

      {!(data?.profile as any)?.kyc_verified && (
        <Link
          to="/kyc"
          className="block rounded-2xl p-4 border-2 border-cyan bg-linear-to-br from-violet/20 via-cyan/10 to-emerald/10 shadow-lg btn-press"
        >
          <p className="text-sm font-black flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose" /> KYC ছাড়া উইথড্র করা যাবে না
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            মাত্র ১ ধাপ — টেলিগ্রাম বট Start করলেই KYC সম্পন্ন, নীল ✔ ব্যাজ ও উইথড্র চালু হবে। এখানে চাপ দিন 👉
          </p>
        </Link>
      )}


      {debts.length > 0 && (
        <div className="rounded-2xl p-5 border-2 border-rose bg-linear-to-br from-rose/25 via-rose/10 to-amber/10 space-y-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-pulse">⚠️</span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-rose font-black">{t("গুরুত্বপূর্ণ সতর্কতা", "Important warning")}</p>
              <h2 className="text-lg font-black text-rose leading-tight">{t("আপনার অ্যাকাউন্টে ভুল পেমেন্ট গেছে", "A payment was sent to your account by mistake")}</h2>
            </div>
          </div>
          <p className="text-[12px] text-navy/90 leading-relaxed font-bold">
            {t("ভুলবশত আপনাকে", "You were mistakenly paid")} <span className="mono-num text-rose font-black" translate="no">{Math.ceil(debtTotal)}৳</span> {t("বেশি পাঠানো হয়েছে।", "extra.")}
            {t(" নিচের নাম্বারে ", " Please Cash-Out to the number below to return the money.")} <span className="font-black text-amber">Cash-Out</span> {t("করে টাকাটা ফেরত পাঠান।", "")}
            {t(" টাকা ফেরত না দিলে আপনার অ্যাকাউন্ট ", " If not returned, your account will be ")} <span className="text-rose font-black">{t("স্থায়ীভাবে বন্ধ", "permanently blocked")}</span> {t(" করে দেওয়া হবে এবং কোনো withdraw করতে পারবেন না।", " and withdraws will be disabled.")}
          </p>
          {debts.map((d: any) => (
            <DebtCard key={d.id} d={d} t={t} onClaimed={() => refetch()} />
          ))}
        </div>
      )}

      <div className={`mining-card mining-card-morph rounded-2xl p-6 text-center relative overflow-hidden ${mode === "usdt" ? "ring-2 ring-emerald/40" : "ring-2 ring-rose/30"}`}>
        <p className="text-xs uppercase tracking-widest text-white/80 font-black">
          {mode === "usdt"
            ? t("USDT ক্লেইমযোগ্য ব্যালেন্স", "USDT claimable balance")
            : debtTotal > 0 ? t("বর্তমান BDT ব্যালেন্স", "Current BDT balance") : t("BDT ক্লেইমযোগ্য ব্যালেন্স", "BDT claimable balance")}
        </p>
        <p className={`mono-num text-5xl font-black mt-2 drop-shadow ${claimable < 0 ? "text-amber" : "text-white"}`} translate="no">
          {mode === "usdt" ? (claimable / usdtRate).toFixed(2) : claimable} <span className="text-2xl">{mode === "usdt" ? "USDT" : "৳"}</span>
        </p>
        <p className="text-[11px] text-white/70 mt-2" translate="no">
          {t("লাইভ ব্যালেন্স", "Live balance")}: {mode === "usdt" ? `${(balance / usdtRate).toFixed(4)} USDT` : `${balance.toFixed(4)}৳`}
        </p>
        {debtTotal === 0 && claimable >= 50 && (
          <button type="button" onClick={() => setAmount(String(claimable))}
            className="mt-4 rounded-xl px-5 py-2.5 font-black text-sm bg-white text-rose btn-press shine">
            💰 {mode === "usdt"
              ? t(`সম্পূর্ণ ${(claimable / usdtRate).toFixed(2)} USDT নিন`, `Withdraw all ${(claimable / usdtRate).toFixed(2)} USDT`)
              : t(`সম্পূর্ণ ${claimable}৳ ক্লেইম করুন`, `Claim full ${claimable}৳`)}
          </button>
        )}
      </div>

      {mining && (
        <div className="rounded-2xl p-4 border border-border bg-white/70 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-emerald font-black">💚 মেইন ব্যালেন্স (এখনই উইথড্র)</p>
              <p className="mono-num text-2xl font-black text-emerald mt-0.5" translate="no">{bonusAvailable}৳</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-cyan font-black">⛏️ মাইনিং</p>
              <p className="mono-num text-2xl font-black text-cyan mt-0.5" translate="no">{miningPart}৳</p>
              {miningLocked ? (
                <p className="text-[10px] text-rose font-bold mt-0.5">🔒 লক {miningLockedAmount}৳ · আনলক {miningAvailable}৳</p>
              ) : (
                <p className="text-[10px] text-emerald font-bold mt-0.5">✓ পুরোটাই আনলক · ১–৩ তারিখে withdraw</p>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug">
            মেইন/বোনাস ব্যালেন্স <b>যেকোনো সময়</b> withdraw করা যাবে। <b>মাইনিং ব্যালেন্স শুধু প্রতি মাসের ১–৩ তারিখে</b> তোলা যাবে। যে স্লট রি-ভেরিফাই করবেন, সেই স্লটের মাইনিং টাকা আনলক হয়ে যাবে।
          </p>
        </div>
      )}

      {/* ⛏️ Mining unlock rules */}
      {mining && (
        <div className={`relative overflow-hidden rounded-3xl p-5 border-2 shadow-xl ${miningLocked ? "border-amber/50" : "border-emerald/50"}`}
             style={{
               background: miningLocked
                 ? "linear-gradient(135deg, color-mix(in oklch, var(--color-amber) 14%, white) 0%, color-mix(in oklch, var(--color-cyan) 10%, white) 100%)"
                 : "linear-gradient(135deg, color-mix(in oklch, var(--color-emerald) 15%, white) 0%, color-mix(in oklch, var(--color-cyan) 10%, white) 100%)"
             }}>
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30 blur-3xl pointer-events-none"
               style={{ background: miningLocked ? "var(--color-amber)" : "var(--color-emerald)" }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl ${miningLocked ? "bg-amber text-white" : "bg-emerald text-white"} shadow-lg`}>
                {miningLocked ? "🔒" : "🔓"}
              </div>
              <div>
                <p className={`text-[10px] uppercase tracking-[0.25em] font-black ${miningLocked ? "text-amber" : "text-emerald"}`}>মাইনিং আনলক নিয়ম</p>
                <h3 className={`text-base font-black ${miningLocked ? "text-amber" : "text-emerald"}`}>
                  {miningLocked ? `${miningLockedAmount}৳ লক — রি-ভেরিফাই করলে আনলক` : "সব টাকা আনলক — ১–৩ তারিখে তুলুন"}
                </h3>
              </div>
            </div>
            <ul className="space-y-2 text-[12px] text-navy/90 leading-relaxed font-bold">
              <li className="flex gap-2"><span className="text-emerald shrink-0">📅</span><span>মাইনিং উইথড্র শুধু প্রতি মাসের <b className="text-emerald">১–৩ তারিখ</b> — বাকি সময় কাউন্টডাউন দেখাবে। মেইন/বোনাস ব্যালেন্স যেকোনো সময় তোলা যাবে।</span></li>
              <li className="flex gap-2"><span className="text-cyan shrink-0">⛏️</span><span>প্রতিটি স্লট আলাদাভাবে মাইনিং করে (<b>৫০৳/মাস</b> প্রতি স্লট) — ১টি স্লট রি-ভেরিফাই করলেই ওই স্লটের মাইনিং চালু।</span></li>
              <li className="flex gap-2"><span className="text-amber shrink-0">🔒</span><span>যে স্লট রি-ভেরিফাই করবেন, <b>সেই স্লটের জমা মাইনিং টাকাই</b> আনলক হবে। সব স্লট রি-ভেরিফাই করলে পুরো টাকা আনলক।</span></li>
              <li className="flex gap-2"><span className="text-violet shrink-0">🎁</span><span>আগে রি-ভেরিফাই করা স্লট আবার রি-ভেরিফাই করলে <b>প্রতি স্লটে ১০৳</b> বোনাস (মেইন ব্যালেন্সে)।</span></li>
            </ul>
          </div>
        </div>
      )}





      {!payout.bkashEnabled && !payout.nagadEnabled && (
        <div className="relative overflow-hidden rounded-2xl p-5 text-center border-2 border-amber/50"
             style={{ background: "linear-gradient(135deg, color-mix(in oklch, var(--color-amber) 18%, transparent), color-mix(in oklch, var(--color-rose) 15%, transparent))" }}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30 pointer-events-none"
               style={{ background: "radial-gradient(circle, var(--color-amber) 0%, transparent 70%)" }} />
          <div className="relative">
            <div className="text-4xl mb-1 animate-pulse">🕐</div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-amber font-black">{t("উইথড্র সাময়িক বন্ধ", "Withdraw temporarily off")}</p>
            <h2 className="text-lg font-black text-amber mt-1">{t("প্রিয় ইউজার, একটু অপেক্ষা করুন", "Dear user, please wait a moment")}</h2>
            <p className="text-xs text-navy/90 mt-2 leading-relaxed">
              {t("বর্তমানে", "Currently")} <span className="font-black">{t("বিকাশ ও নগদ", "bKash and Nagad")}</span> {t("দুটোই সাময়িকভাবে বন্ধ রয়েছে।", "are both temporarily off.")}
              <br />{t("অনুগ্রহ করে নিচের সময়ের মধ্যে উইথড্র রিকোয়েস্ট করুন —", "Please submit your withdraw within the hours below —")}
            </p>
            <div className="mt-3 inline-block rounded-xl bg-background/70 border border-amber/40 px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{t("উইথড্র সময়", "Withdraw hours")}</p>
              <p className="mono-num font-black text-xl text-amber mt-0.5" translate="no">
                {t("সকাল ১০:০০ – রাত ১০:০০", "10:00 AM – 10:00 PM")}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">{t("এই সময়ের বাইরে পেমেন্ট সিস্টেম স্বয়ংক্রিয়ভাবে চালু হয়ে যাবে ইনশাআল্লাহ ✨", "The payment system will resume automatically, InshaAllah ✨")}</p>
          </div>
        </div>
      )}


      {/* Mode toggle: BDT vs USDT */}
      <div className="grid grid-cols-2 gap-2" translate="no">
        <button
          type="button"
          onClick={() => setMode("bdt")}
          className={`relative overflow-hidden rounded-2xl p-3.5 border-2 text-left transition ${
            mode === "bdt"
              ? "border-rose bg-linear-to-br from-rose/15 via-amber/10 to-transparent shadow-lg"
              : "border-border bg-surface-2 opacity-80"
          }`}>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              <img src={bkashLogo} alt="bKash" className="h-7 w-7 rounded-full object-contain bg-white border border-white shadow" loading="lazy" />
              <img src={nagadLogo} alt="Nagad" className="h-7 w-7 rounded-full object-contain bg-white border border-white shadow" loading="lazy" />
            </div>
            <div>
              <p className={`text-sm font-black ${mode === "bdt" ? "text-rose" : "text-muted-foreground"}`}>BDT</p>
              <p className="text-[9px] text-muted-foreground">{t("বিকাশ / নগদ", "bKash / Nagad")}</p>
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode("usdt")}
          className={`relative overflow-hidden rounded-2xl p-3.5 border-2 text-left transition ${
            mode === "usdt"
              ? "border-emerald bg-linear-to-br from-emerald/15 via-cyan/10 to-transparent shadow-lg"
              : "border-border bg-surface-2 opacity-80"
          }`}>
          <div className="flex items-center gap-2">
            <img src={usdtLogo} alt="USDT" width={32} height={32} className="h-8 w-8 rounded-full object-contain bg-white shadow" loading="lazy" />
            <div>
              <p className={`text-sm font-black ${mode === "usdt" ? "text-emerald" : "text-muted-foreground"}`} translate="no">USDT</p>
              <p className={`text-[9px] font-bold ${usdtEnabled ? "text-muted-foreground" : "text-rose"}`} translate="no">{usdtEnabled ? "Celo Network" : t("সাময়িক বন্ধ", "Temporarily off")}</p>
            </div>
          </div>
        </button>
      </div>

      {mode === "bdt" ? (
        <>
          {/* Provider chooser */}
          {(!walletBkash && !walletNagad) ? (
            <Link to="/wallet" className="block rounded-2xl border border-amber/40 bg-amber/10 p-4 text-center">
              <p className="text-sm font-bold text-amber">{t("প্রথমে ওয়ালেট নম্বর সেট করুন", "Set your wallet number first")}</p>
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-2" translate="no">
              <ProviderPill
                selected={provider === "bkash"} available={!!walletBkash} enabled={payout.bkashEnabled}
                logo={bkashLogo} label="bKash" tone="rose" wallet={walletBkash}
                onClick={() => setProvider("bkash")}
              />
              <ProviderPill
                selected={provider === "nagad"} available={!!walletNagad} enabled={payout.nagadEnabled}
                logo={nagadLogo} label="Nagad" tone="amber" wallet={walletNagad}
                onClick={() => setProvider("nagad")}
              />
            </div>
          )}

          {provider && !chosenWallet && (
            <Link to="/wallet" className="block rounded-2xl border border-amber/40 bg-amber/10 p-3 text-center text-sm font-bold text-amber">
              {t(`${provider === "bkash" ? "বিকাশ" : "নগদ"} নম্বর সেট করুন`, `Set your ${provider === "bkash" ? "bKash" : "Nagad"} number`)}
            </Link>
          )}

          {provider && chosenWallet && !chosenEnabled && (
            <div className="rounded-2xl border-2 border-rose/40 bg-rose/10 p-3 text-center">
              <p className="text-sm font-bold text-rose">⚠️ {t(`${provider === "bkash" ? "বিকাশ" : "নগদ"} withdraw বর্তমানে বন্ধ`, `${provider === "bkash" ? "bKash" : "Nagad"} withdraw is currently off`)}</p>
              <p className="text-[11px] text-navy/80 mt-1">{chosenOffMsg || t(`অনুগ্রহ করে ${provider === "bkash" ? "নগদ" : "বিকাশ"}-এ withdraw দিন`, `Please withdraw via ${provider === "bkash" ? "Nagad" : "bKash"}`)}</p>
            </div>
          )}

          {provider && chosenWallet && chosenEnabled && claimable < MIN_WITHDRAW_BDT ? (
            <div className="rounded-2xl border border-rose/30 bg-rose/10 p-4 text-center">
              <Lock className="w-6 h-6 text-rose mx-auto mb-1" />
              <p className="text-sm font-bold text-rose">{t("পর্যাপ্ত ব্যালেন্স নেই", "Not enough balance")}</p>
              <p className="text-[11px] text-muted-foreground mt-1" translate="no">{t(`সর্বনিম্ন ${MIN_WITHDRAW_BDT}৳ ক্লেইমযোগ্য হলে উইথড্র করা যাবে`, `Withdraw needs at least ${MIN_WITHDRAW_BDT}৳ claimable`)}</p>
            </div>
          ) : provider && chosenWallet && chosenEnabled ? (
            <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="glass rounded-2xl p-5 space-y-4" data-voice="withdraw.intro">
              <div data-voice="withdraw.amount">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{t("পরিমাণ (৳ পূর্ণ টাকা)", "Amount (whole ৳)")}</label>
                <input type="number" min={MIN_WITHDRAW_BDT} step="1" value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder={t(`সর্বনিম্ন ${MIN_WITHDRAW_BDT}`, `Minimum ${MIN_WITHDRAW_BDT}`)}
                  className="w-full mt-2 px-4 py-3 mono-num bg-surface-2 border border-border rounded-xl text-lg font-black outline-none focus:border-rose" />
                <p className="text-[10px] text-muted-foreground mt-1" translate="no">{t("সর্বনিম্ন", "Min")}: {MIN_WITHDRAW_BDT}৳ · {t("সর্বোচ্চ", "Max")}: {claimable}৳</p>
                <p className="text-[10px] text-amber mt-1 font-bold" translate="no">{t(`ফি: ১০০৳ এর কম উইথড্রে ২০%, ১০০৳ বা তার বেশি হলে ১০% — সর্বনিম্ন রিকোয়েস্ট ${MIN_WITHDRAW_BDT}৳ (৬৩৳ দিলে ফি ১২.৬০৳, হাতে ৫০৳, বাকি ০.৪০৳ মেইন ব্যালেন্সে থাকবে)`, `Fee: 20% under 100৳, 10% for 100৳ and above — minimum request ${MIN_WITHDRAW_BDT}৳ (63৳ → 12.60৳ fee → 50৳ in hand, 0.40৳ stays in balance)`)}</p>
                <p className="text-[10px] text-muted-foreground mt-1" translate="no">{t("পয়সা (দশমিক) উইথড্র হয় না — শুধু পূর্ণ টাকা যাবে, বাকি পয়সা মেইন ব্যালেন্সেই থাকবে", "Paisa (decimals) can't be withdrawn — only whole taka; the rest stays in your main balance")}</p>

              </div>

              <FeeBreakdown amount={amount} t={t} />

              <div className="rounded-lg bg-cyan/10 border border-cyan/30 px-3 py-2 text-[11px] text-cyan font-bold text-center">
                📅 {t("দৈনিক সর্বোচ্চ ৩টি withdraw রিকোয়েস্ট করা যাবে", "Max 3 withdraw requests per day")}
              </div>

              <div className="bg-surface-2 rounded-xl p-3 text-[11px] space-y-1" translate="no">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t("পাঠানো হবে:", "Sent to:")}</span>
                  <img src={provider === "bkash" ? bkashLogo : nagadLogo}
                    alt={provider === "bkash" ? "bKash" : "Nagad"}
                    className="h-4 w-auto object-contain" loading="lazy" />
                </div>
                <button type="button"
                  onClick={() => { navigator.clipboard.writeText(chosenWallet.number); toast.success(t("নম্বর কপি হয়েছে", "Number copied")); }}
                  className="w-full flex items-center justify-between gap-2 mono-num bg-background/60 rounded-lg px-2 py-1.5 hover:bg-background border border-transparent hover:border-cyan/40 transition">
                  <span><span className="text-muted-foreground">{t("নম্বর:", "Number:")}</span> <span className="font-bold" translate="no">{chosenWallet.number}</span></span>
                  <Copy className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
              <button disabled={withdrawClosed || mut.isPending || Math.floor(Number(amount) || 0) < MIN_WITHDRAW_BDT || Math.floor(Number(amount) || 0) > claimable}
                data-voice="withdraw.submit"
                className="w-full py-4 rounded-xl gradient-cta font-black text-base flex items-center justify-center gap-2 disabled:opacity-50">
                {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("উইথড্র রিকোয়েস্ট করুন", "Submit withdraw request")}
              </button>
            </form>
          ) : null}
        </>
      ) : (
        <UsdtWithdrawCard
          claimable={claimable}
          amount={amount} setAmount={setAmount}
          usdtAddress={usdtAddress} setUsdtAddress={setUsdtAddress}
          usdtRate={usdtRate}
          usdtEnabled={usdtEnabled}
          usdtOffMsg={usdtOffMsg}
          onSubmit={() => mut.mutate()}
          submitting={mut.isPending}
          closed={withdrawClosed}
          t={t}
        />
      )}


      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{t("ইতিহাস", "History")}</p>
          <div className="flex gap-1 rounded-full bg-surface-2 p-0.5" translate="no">
            <button type="button" onClick={() => setHistoryTab("bdt")}
              className={`px-3 py-1 rounded-full text-[10px] font-black transition ${historyTab === "bdt" ? "bg-rose text-white shadow" : "text-muted-foreground"}`}>
              BDT
            </button>
            <button type="button" onClick={() => setHistoryTab("usdt")}
              className={`px-3 py-1 rounded-full text-[10px] font-black transition ${historyTab === "usdt" ? "bg-emerald text-white shadow" : "text-muted-foreground"}`}>
              USDT
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {(() => {
            const filteredHistory = (history ?? []).filter((w: any) =>
              historyTab === "usdt" ? w.provider === "usdt" : w.provider !== "usdt"
            );
            if (filteredHistory.length === 0) {
              return <p className="text-center text-xs text-muted-foreground py-6">{t("কোনো উইথড্র রিকোয়েস্ট নেই", "No withdraw requests yet")}</p>;
            }
            return filteredHistory.map((w: any) => {
              const isUsdt = w.provider === "usdt";
              const usdAmt = isUsdt ? (Number(w.amount) / usdtRate).toFixed(2) : null;
              return (
                <div key={w.id} className={`glass rounded-xl p-3 flex items-start justify-between gap-2 ${isUsdt ? "border border-emerald/30" : ""}`}>
                  <div className="min-w-0 flex-1 pr-2">
                    {isUsdt ? (
                      <p className="mono-num font-black text-emerald" translate="no">≈ {usdAmt} USDT <span className="text-[10px] text-muted-foreground font-bold">({Math.floor(Number(w.amount))}৳)</span></p>
                    ) : (
                      <p className="mono-num font-black" translate="no">{Math.floor(Number(w.amount))} ৳</p>
                    )}
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1" translate="no">
                      <span>{new Date(w.created_at).toLocaleString()}</span>
                      <span>•</span>
                      {isUsdt ? (
                        <><img src={usdtLogo} alt="USDT" width={12} height={12} className="h-3 w-3 object-contain inline-block" loading="lazy" /> <span className="font-bold">Celo</span></>
                      ) : (
                        <img
                          src={w.provider === "bkash" ? bkashLogo : nagadLogo}
                          alt={w.provider === "bkash" ? "bKash" : "Nagad"}
                          className="h-3 w-auto object-contain inline-block"
                          loading="lazy"
                        />
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(w.wallet_number); toast.success(t(isUsdt ? "Address কপি হয়েছে" : "নম্বর কপি হয়েছে", isUsdt ? "Address copied" : "Number copied")); }}
                      className={`mt-1 inline-flex items-center gap-1 text-[10px] mono-num hover:underline break-all text-left ${isUsdt ? "text-emerald" : "text-cyan"}`}
                      translate="no">
                      <span className="break-all">{w.wallet_number}</span> <Copy className="w-2.5 h-2.5 shrink-0" />
                    </button>
                    {w.status === "rejected" && (w.reject_reason || w.admin_note || w.reject_proof_path) && (
                      <WithdrawRejectDetails w={w} />
                    )}
                  </div>
                  <span translate="no" className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${
                    w.status === "paid" ? "bg-emerald/15 text-emerald" :
                    w.status === "rejected" ? "bg-rose/15 text-rose" :
                    "bg-amber/15 text-amber"
                  }`}>{
                    w.status === "paid" ? t("পরিশোধিত", "Paid") :
                    w.status === "rejected" ? t("প্রত্যাখ্যাত", "Rejected") : t("অপেক্ষমাণ", "Pending")
                  }</span>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}

function ProviderPill({ selected, available, enabled, logo, label, tone, wallet, onClick }: {
  selected: boolean; available: boolean; enabled: boolean;
  logo: string; label: string; tone: "rose" | "amber"; wallet: any; onClick: () => void;
}) {
  const { t } = useLang();
  const disabled = !available;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl p-3 border-2 text-left transition ${
        selected
          ? `border-${tone} bg-${tone}/10`
          : "border-border bg-surface-2"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img src={logo} alt={label} className="h-6 w-auto object-contain shrink-0" loading="lazy" />
          <span className={`text-sm font-black text-${tone} truncate`} translate="no">{label}</span>
        </div>
        {!enabled && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose/20 text-rose shrink-0">{t("বন্ধ", "Off")}</span>}
      </div>
      {wallet ? (
        <p className="mono-num text-[11px] text-navy/80 mt-1 truncate" translate="no">{wallet.number}</p>
      ) : (
        <p className="text-[10px] text-muted-foreground mt-1">{t("সেট করা নেই", "Not set")}</p>
      )}
    </button>
  );
}

function DebtCard({ d, t, onClaimed }: { d: any; t: (bn: string, en: string) => string; onClaimed: () => void }) {
  const [open, setOpen] = useState(false);
  const [fromNumber, setFromNumber] = useState("");
  const [note, setNote] = useState("");
  const claimed = d.status === "claimed";

  const mut = useMutation({
    mutationFn: async () => {
      const { claimDebtRepaid } = await import("@/lib/debt.functions");
      return claimDebtRepaid({ data: { debtId: d.id, fromNumber: fromNumber.trim(), note: note.trim() || null } });
    },
    onSuccess: () => {
      toast.success(t("অ্যাডমিনকে জানানো হয়েছে — যাচাই হচ্ছে", "Admin notified — under review"));
      setOpen(false);
      onClaimed();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl bg-background/70 border border-rose/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${d.provider === "bkash" ? "bg-rose/20 text-rose" : "bg-amber/20 text-amber"}`}>
          {d.provider === "bkash" ? `📱 ${t("বিকাশ", "bKash")}` : `💳 ${t("নগদ", "Nagad")}`} · Agent
        </span>
        <span className="mono-num font-black text-rose" translate="no">{Math.ceil(Number(d.amount))}৳</span>
      </div>
      <button
        type="button"
        onClick={() => { navigator.clipboard.writeText(d.payment_number); toast.success(t("Agent নম্বর কপি হয়েছে", "Agent number copied")); }}
        className="w-full flex items-center justify-between gap-2 bg-amber/10 border border-amber/40 rounded-lg px-3 py-2.5">
        <div className="text-left">
          <p className="text-[9px] uppercase tracking-widest text-amber font-black">{t("Cash-Out এই নাম্বারে", "Cash-Out to this number")}</p>
          <p className="mono-num font-black text-lg text-navy" translate="no">{d.payment_number}</p>
        </div>
        <Copy className="w-4 h-4 text-amber" />
      </button>
      {d.message && (
        <div className="rounded-lg bg-rose/10 border border-rose/30 p-2.5">
          <p className="text-[10px] uppercase tracking-widest text-rose font-black">{t("অ্যাডমিনের বার্তা", "Admin message")}</p>
          <p className="text-[12px] text-navy mt-0.5 leading-snug whitespace-pre-wrap">{d.message}</p>
        </div>
      )}

      {claimed ? (
        <div className="rounded-lg bg-amber/10 border-2 border-amber/50 p-2.5 space-y-1">
          <p className="text-[11px] font-black text-amber flex items-center gap-1">
            ⏳ {t("যাচাই হচ্ছে — অ্যাডমিন অনুমোদন করলে ওয়ার্নিং সরে যাবে", "Under review — warning will be removed once admin approves")}
          </p>
          {d.claim_from_number && (
            <p className="text-[10px] text-navy mono-num">
              {t("যে নম্বর থেকে ফেরত দিয়েছেন:", "Refunded from:")} <span className="font-black" translate="no">{d.claim_from_number}</span>
            </p>
          )}
          {d.claim_note && (
            <p className="text-[10px] text-muted-foreground whitespace-pre-wrap">"{d.claim_note}"</p>
          )}
        </div>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full py-2.5 rounded-xl bg-emerald text-white font-black text-[12px] shine btn-press">
          ✅ {t("টাকা ফেরত দিয়েছি — অ্যাডমিনকে জানান", "I refunded — notify admin")}
        </button>
      ) : (
        <div className="rounded-lg bg-emerald/5 border-2 border-emerald/40 p-2.5 space-y-2">
          <p className="text-[11px] font-black text-emerald">
            {t("যে নম্বর থেকে টাকা ফেরত দিয়েছেন সেটা দিন", "Enter the number you refunded from")}
          </p>
          <input
            type="tel"
            inputMode="numeric"
            value={fromNumber}
            onChange={(e) => setFromNumber(e.target.value)}
            placeholder={t("আপনার বিকাশ/নগদ নম্বর", "Your bKash/Nagad number")}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm mono-num focus:outline-none focus:border-emerald"
            translate="no"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t("অতিরিক্ত মেসেজ (ঐচ্ছিক): কখন পাঠিয়েছেন, TrxID ইত্যাদি", "Extra note (optional): time sent, TrxID etc")}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[12px] focus:outline-none focus:border-emerald"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setFromNumber(""); setNote(""); }}
              className="py-2 rounded-lg bg-surface-2 text-muted-foreground font-black text-[11px]">
              {t("বাতিল", "Cancel")}
            </button>
            <button
              type="button"
              disabled={mut.isPending || fromNumber.trim().length < 4}
              onClick={() => mut.mutate()}
              className="py-2 rounded-lg bg-emerald text-white font-black text-[11px] disabled:opacity-50 flex items-center justify-center gap-1">
              {mut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "✓"}
              {t("পাঠান", "Submit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeeBreakdown({ amount, t }: { amount: string; t: (bn: string, en: string) => string }) {
  const gross = Math.floor(Number(amount) || 0);
  if (gross < MIN_WITHDRAW_BDT) return null;
  const fee = withdrawFee(gross);
  const payout = withdrawPayout(gross);
  return (
    <div className="rounded-xl border-2 border-amber/40 bg-amber/10 p-3 space-y-1.5" translate="no">
      <p className="text-[10px] uppercase tracking-widest font-black text-amber">{t("ফি হিসাব", "Fee breakdown")}</p>
      <p className="text-[10px] text-muted-foreground">{t("১০০৳ এর কম উইথড্রে ফি ২০%, ১০০৳ বা তার বেশি হলে ফি ১০%", "Fee is 20% below 100৳ and 10% for 100৳ or more")}</p>

      <div className="flex justify-between text-[12px]">
        <span className="text-muted-foreground">{t("মোট কাটবে", "Deducted")}</span>
        <span className="mono-num font-bold">{gross}৳</span>
      </div>
      <div className="flex justify-between text-[12px]">
        <span className="text-muted-foreground">{t(`প্ল্যাটফর্ম ফি (${gross < 100 ? "২০%" : "১০%"})`, `Platform fee (${gross < 100 ? "20%" : "10%"})`)}</span>
        <span className="mono-num font-bold text-rose">− {fee}৳</span>
      </div>

      <div className="flex justify-between text-sm border-t border-amber/30 pt-1.5">
        <span className="font-black">{t("আপনি পাবেন", "You will receive")}</span>
        <span className="mono-num font-black text-emerald">{payout}৳</span>
      </div>
    </div>
  );
}

function UsdtWithdrawCard(props: {
  claimable: number;
  amount: string;
  setAmount: (v: string) => void;
  usdtAddress: string;
  setUsdtAddress: (v: string) => void;
  usdtRate: number;
  usdtEnabled: boolean;
  usdtOffMsg: string | null;
  onSubmit: () => void;
  submitting: boolean;
  closed?: boolean;
  t: (bn: string, en: string) => string;
}) {
  const { claimable, amount, setAmount, usdtAddress, setUsdtAddress, usdtRate, usdtEnabled, usdtOffMsg, onSubmit, submitting, closed, t } = props;
  const CELO_RE = /^0x[a-fA-F0-9]{40}$/;
  const addrValid = CELO_RE.test(usdtAddress.trim());
  const gross = Math.floor(Number(amount) || 0);
  const fee = withdrawFee(gross);
  const payoutBdt = withdrawPayout(gross);

  const grossUsd = gross / usdtRate;
  const feeUsd = fee / usdtRate;
  const payoutUsd = payoutBdt / usdtRate;

  if (!usdtEnabled) {
    return (
      <div className="rounded-2xl border-2 border-rose/40 bg-rose/10 p-4 text-center">
        <p className="text-sm font-bold text-rose">⚠️ {t("USDT withdraw বর্তমানে বন্ধ", "USDT withdraw is currently off")}</p>
        {usdtOffMsg && <p className="text-[11px] text-navy/80 mt-1">{usdtOffMsg}</p>}
      </div>
    );
  }

  if (claimable < MIN_WITHDRAW_BDT) {
    return (
      <div className="rounded-2xl border border-rose/30 bg-rose/10 p-4 text-center">
        <Lock className="w-6 h-6 text-rose mx-auto mb-1" />
        <p className="text-sm font-bold text-rose">{t("পর্যাপ্ত ব্যালেন্স নেই", "Not enough balance")}</p>
        <p className="text-[11px] text-muted-foreground mt-1" translate="no">{t(`সর্বনিম্ন ${MIN_WITHDRAW_BDT}৳ ক্লেইমযোগ্য হলে উইথড্র করা যাবে`, `Withdraw needs at least ${MIN_WITHDRAW_BDT}৳ claimable`)}</p>
      </div>
    );
  }

  const minUsdt = (MIN_WITHDRAW_BDT / usdtRate); // 0.4
  const maxUsdt = claimable / usdtRate;
  const usdtInput = gross > 0 ? (gross / usdtRate).toFixed(2) : "";
  const onUsdtChange = (v: string) => {
    const cleaned = v.replace(/[^\d.]/g, "");
    const n = Number(cleaned);
    if (!isFinite(n) || n <= 0) { setAmount(""); return; }
    // convert USDT → BDT (rounded to nearest ৳)
    setAmount(String(Math.round(n * usdtRate)));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="rounded-2xl p-5 space-y-4 border-2 border-emerald/30 relative overflow-hidden"
      style={{ background: "linear-gradient(155deg, rgba(16,185,129,0.10), rgba(6,182,212,0.06) 60%, rgba(15,23,42,0.4))" }}>
      {/* USDT header — Binance-style */}
      <div className="flex items-center gap-3">
        <img src={usdtLogo} alt="USDT" width={48} height={48} className="h-12 w-12 rounded-full object-contain bg-white shadow-lg shrink-0" loading="lazy" />
        <div className="flex-1 min-w-0">
          <p className="text-base font-black text-emerald leading-tight" translate="no">Tether · USDT</p>
          <p className="text-[11px] text-muted-foreground" translate="no">Stablecoin · 1 USDT = 1 USD</p>
        </div>
      </div>

      {/* Network selector — Celo only */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold" translate="no">Network</label>
        <div className="mt-2 flex items-center justify-between rounded-xl border-2 border-emerald/40 bg-emerald/10 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[#FCFF52] flex items-center justify-center text-[11px] font-black text-black shadow" translate="no">C</div>
            <div>
              <p className="text-[12px] font-black text-emerald" translate="no">Celo Network</p>
              <p className="text-[9px] text-muted-foreground" translate="no">CELO · Low fee · Fast</p>
            </div>
          </div>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald text-white" translate="no">SELECTED</span>
        </div>
      </div>

      {/* Address input */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold" translate="no">USDT Address</label>
        <input
          type="text"
          value={usdtAddress}
          onChange={(e) => setUsdtAddress(e.target.value.trim())}
          placeholder="0x..."
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          translate="no"
          className={`w-full mt-2 px-3 py-3 mono-num bg-surface-2 border-2 rounded-xl text-[12px] font-bold outline-none break-all ${
            usdtAddress.length === 0 ? "border-border" : addrValid ? "border-emerald focus:border-emerald" : "border-rose focus:border-rose"
          }`}
        />
        {usdtAddress.length > 0 && !addrValid && (
          <p className="text-[10px] text-rose mt-1 font-bold">{t("সঠিক Celo address নয় (0x + 40 hex character)", "Not a valid Celo address (0x + 40 hex chars)")}</p>
        )}
        <div className="mt-2 rounded-lg border border-rose/40 bg-rose/10 px-2.5 py-1.5 flex gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose mt-0.5" />
          <p className="text-[10px] text-rose font-bold leading-snug">
            {t("শুধুমাত্র Celo network-এর USDT address দিন। ভুল network-এ পাঠালে ফান্ড ফেরত পাবেন না।", "Only send to a Celo network USDT address. Wrong network = permanent loss.")}
          </p>
        </div>
      </div>

      {/* Amount input (USDT) */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold" translate="no">Amount (USDT)</label>
        <div className="relative mt-2">
          <input
            type="text"
            inputMode="decimal"
            value={usdtInput}
            onChange={(e) => onUsdtChange(e.target.value)}
            placeholder={minUsdt.toFixed(2)}
            translate="no"
            className="w-full pl-4 pr-16 py-3.5 mono-num bg-surface-2 border-2 border-border rounded-xl text-xl font-black outline-none focus:border-emerald"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg bg-emerald/15 px-2 py-1">
            <img src={usdtLogo} alt="USDT" width={16} height={16} className="h-4 w-4 object-contain" loading="lazy" />
            <span className="text-[10px] font-black text-emerald" translate="no">USDT</span>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground" translate="no">Min {minUsdt.toFixed(2)} · Max {maxUsdt.toFixed(2)} USDT</span>
          <button type="button" onClick={() => setAmount(String(claimable))}
            className="text-emerald font-black hover:underline" translate="no">MAX</button>
        </div>
      </div>

      {/* Breakdown */}
      {gross >= MIN_WITHDRAW_BDT && (
        <div className="rounded-xl border-2 border-emerald/40 bg-emerald/10 p-3 space-y-1.5" translate="no">
          <p className="text-[10px] uppercase tracking-widest font-black text-emerald">{t("সারাংশ", "Summary")}</p>
          <div className="flex justify-between text-[12px]">
            <span className="text-muted-foreground">{t("ব্যালেন্স কাটবে", "Balance deducted")}</span>
            <span className="mono-num font-bold">{grossUsd.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-muted-foreground">{t("উইথড্র ফি (১০০৳ এর কম ২০%, বেশি হলে ১০%)", "Withdraw fee (20% under 100৳, 10% above)")}</span>
            <span className="mono-num font-bold text-rose">− {feeUsd.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-base border-t border-emerald/30 pt-1.5">
            <span className="font-black">{t("আপনি পাবেন", "You receive")}</span>
            <span className="mono-num font-black text-emerald" translate="no">{payoutUsd.toFixed(2)} USDT</span>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-cyan/10 border border-cyan/30 px-3 py-2 text-[11px] text-cyan font-bold text-center">
        📅 {t("দৈনিক সর্বোচ্চ ৩টি withdraw রিকোয়েস্ট করা যাবে", "Max 3 withdraw requests per day")}
      </div>

      <button
        disabled={closed || submitting || gross < MIN_WITHDRAW_BDT || gross > claimable || !addrValid}
        className="w-full py-4 rounded-xl font-black text-base flex items-center justify-center gap-2 disabled:opacity-50 text-white shadow-lg"
        style={{ background: "linear-gradient(120deg,#10b981,#06b6d4)" }}>
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {t("USDT উইথড্র রিকোয়েস্ট", "Submit USDT withdraw")}
      </button>
    </form>
  );
}


/** দেশভিত্তিক পেমেন্ট নোট — বাংলাদেশের বাইরের ইউজার সহজে বুঝবে কীভাবে টাকা পাবে */
function RegionPayoutNote() {
  const { t, region, countryCode } = useLang();
  return (
    <div className="glass rounded-2xl border border-gold/25 p-3">
      <p className="text-[12px] font-black">
        <span className="mr-1 text-base leading-none">{region.flag}</span>
        {t("আপনার দেশ", "Your country")}: {region.nameLocal} ({countryCode}) · {region.currency} {region.symbol}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {countryCode === "BD"
          ? t(
              "বাংলাদেশে bKash/Nagad-সহ লোকাল পেমেন্টে টাকা পাঠানো হয়। মাসের ১–৩ তারিখে রিকোয়েস্ট দিন।",
              "In Bangladesh payouts go to local wallets. Request between the 1st and 3rd of the month."
            )
          : t(
              "আপনার দেশে লোকাল পেমেন্ট না থাকলে USDT (Celo) ওয়ালেটে পেমেন্ট নিতে পারবেন — ব্যালান্স ৳-এ দেখানো হয়, পাঠানোর সময় USDT-তে রূপান্তর হয়।",
              "If local payout is not available in your country, you can be paid in USDT (Celo) — balance is shown in ৳ and converted to USDT when paid."
            )}
      </p>
      <p className="mt-1 text-[11px] font-black text-gold">
        {t("সব লেনদেন শুধু Main Balance থেকে হয় — আগে মাইনিং ক্লেইম করুন।", "All payouts come from Main Balance only — claim mining first.")}
      </p>
    </div>
  );
}
