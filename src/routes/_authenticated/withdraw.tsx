import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getDashboard, getMyWithdrawals } from "@/lib/dashboard.functions";
import { requestWithdraw } from "@/lib/withdraw.functions";
import { withdrawPayout, MIN_WITHDRAW_BDT, withdrawFee } from "@/lib/constants";
import { useState, useEffect } from "react";
import { ArrowDownToLine, Loader2, Lock, Copy, ShieldAlert, CalendarDays, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageVoice } from "@/components/PageVoice";
import bkashLogo from "@/assets/bkash-logo.png";
import nagadLogo from "@/assets/nagad-logo.png";
import usdtLogo from "@/assets/usdt-logo.png";
import { useLang } from "@/lib/i18n";
import { withdrawCountdownInfo } from "@/lib/withdraw-window";
import { WithdrawClosedBanner } from "@/components/WithdrawClosedBanner";
import { WithdrawCountdown } from "@/components/WithdrawCountdown";
import { WithdrawRejectDetails } from "@/components/WithdrawRejectDetails";
import { isLiteBuild } from "@/lib/lite-build";
import { isStoreBuild } from "@/lib/store-build";
import { LiteFeatureBlock } from "@/components/LiteFeatureBlock";
import { Button } from "@/components/ui/button";



export const Route = createFileRoute("/_authenticated/withdraw")({
  head: () => ({
    meta: [
      { title: "উইথড্র | GoodApp" },
      { name: "description", content: "GoodApp ব্যালান্স থেকে বিকাশ বা নগদে উইথড্র করুন।" },
      { property: "og:title", content: "উইথড্র | GoodApp" },
      { property: "og:description", content: "ব্যালান্স, সময় ও পেমেন্ট মাধ্যম দেখে সহজে উইথড্র করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WithdrawPage,
});

function WithdrawPage() {
  if (isLiteBuild()) return <LiteFeatureBlock title="উইথড্র" />;
  const { t } = useLang();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["withdrawals"], queryFn: () => getMyWithdrawals(),
  });

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

  // USDT (crypto) payouts are removed from the withdraw UI everywhere —
  // Play policy penalises crypto payouts, and the same UI serves the website.
  const store = isStoreBuild();
  const mode = "bdt" as const;
  const historyTab = "bdt" as const;
  const usdtAddress = "";
  const usdtRate = Number((data as any)?.payoutSettings?.usdtRateBdt ?? 130);
  const usdtEnabled = false;
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
        storeBuild: store,
        provider: provider ?? undefined,
      },
    }),
    onSuccess: () => {
      toast.success(t("উইথড্র রিকোয়েস্ট পাঠানো হয়েছে! অ্যাডমিন শীঘ্রই প্রসেস করবেন।", "Withdraw request submitted! The admin will process it soon."));
      setAmount("");
      refetch(); refetchHistory();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan" /></div>;

  const debts = (data as any)?.debts ?? [];
  const debtTotal = Number((data as any)?.debtTotal ?? 0);

  const breakdown = (data as any).balanceBreakdown || { bonus_part: 0, pending_part: 0 };
  const bonusAvailable = Math.floor(breakdown.bonus_part);
  const pendingPart = Math.floor(breakdown.pending_part ?? 0);
  const monthlyWindow = withdrawCountdownInfo(now);
  // ক্লেইম করা মাইনিং (পেন্ডিং) শুধু ১–৩ তারিখের উইন্ডোতেই তোলা যায়।
  // উইন্ডো বন্ধ থাকলে সেটা আবার পেন্ডিং হিসেবে লক — মেইন ব্যালেন্সে যোগ হবে না।
  const claimable = bonusAvailable;

  const chosenWallet = provider === "bkash" ? walletBkash : provider === "nagad" ? walletNagad : null;
  const chosenEnabled = provider === "bkash" ? payout.bkashEnabled : provider === "nagad" ? payout.nagadEnabled : false;
  const chosenOffMsg  = provider === "bkash" ? payout.bkashOffMessage : payout.nagadOffMessage;

  const adminWithdrawOff = (data as any)?.payoutSettings?.withdrawEnabled === false;
  // বোনাস/মেইন টাকা যেকোনো দিন তোলা যায়; শুধু পেন্ডিং মাইনিং মাসের ১–৩ তারিখে খোলে।
  const withdrawClosed = adminWithdrawOff;
  const enteredAmount = Math.floor(Number(amount) || 0);
  const amountValid = enteredAmount >= MIN_WITHDRAW_BDT && enteredAmount <= claimable;


  return (
    <div className="space-y-4 pt-2">
      <PageVoice pageId="withdraw" steps={["withdraw.intro","withdraw.amount","withdraw.submit"]} />
      <div className="flex items-center gap-3 px-1">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg">
          <ArrowDownToLine className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-black">{t("উইথড্র করুন", "Withdraw")}</h1>
          <p className="text-[11px] font-bold text-muted-foreground">নিজের পরিমাণ লিখে বিকাশ বা নগদ বেছে নিন</p>
        </div>
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

      <div className={`mining-card mining-card-morph rounded-2xl p-5 text-center relative overflow-hidden ${mode === "usdt" ? "ring-2 ring-emerald/40" : "ring-2 ring-primary/30"}`}>
        {monthlyWindow.isOpen && !adminWithdrawOff ? (
          <div className="mx-auto mb-2 flex w-fit items-center gap-1.5 rounded-full border border-emerald/40 bg-emerald/15 px-2.5 py-1 text-[9px] font-black text-emerald">
            <Sparkles className="h-3 w-3" /> {t("🟢 উইথড্র খোলা — এখন তোলা যাবে", "🟢 Withdraw open — you can withdraw now")}
          </div>
        ) : (
          <div className="mx-auto mb-2 flex w-fit items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-black text-white/85">
            <Sparkles className="h-3 w-3" /> {t("⏰ পরের উইথড্র: ১ তারিখ", "⏰ Next withdrawal: the 1st")}
          </div>
        )}
        <p className="text-[10px] font-black text-white/70">
          {mode === "usdt"
            ? t("USDT ক্লেইমযোগ্য ব্যালেন্স", "USDT claimable balance")
            : debtTotal > 0 ? t("বর্তমান BDT ব্যালেন্স", "Current BDT balance") : t("BDT ক্লেইমযোগ্য ব্যালেন্স", "BDT claimable balance")}
        </p>
        <p className={`mono-num text-4xl font-black mt-1 drop-shadow ${claimable < 0 ? "text-amber" : "text-white"}`} translate="no">
          {mode === "usdt" ? (claimable / usdtRate).toFixed(2) : claimable} <span className="text-2xl">{mode === "usdt" ? "USDT" : "৳"}</span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-left">
          <div className="rounded-xl border border-white/15 bg-white/10 p-2.5">
            <p className="text-[9px] font-bold text-white/60">বোনাস · যেকোনো দিন</p>
            <p className="mono-num text-base font-black text-white" translate="no">{bonusAvailable}৳</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-2.5">
            <p className="text-[9px] font-bold text-white/60">পেন্ডিং · তোলা যাবে না</p>
            <p className="mono-num text-base font-black text-white" translate="no">{pendingPart}৳</p>
          </div>
        </div>
        {debtTotal === 0 && claimable >= 50 && (
          <Button type="button" variant="secondary" onClick={() => setAmount(String(claimable))}
            className="mt-3 h-auto rounded-xl px-5 py-2.5 font-black text-sm btn-press shine">
            💰 {mode === "usdt"
              ? t(`সম্পূর্ণ ${(claimable / usdtRate).toFixed(2)} USDT নিন`, `Withdraw all ${(claimable / usdtRate).toFixed(2)} USDT`)
              : t(`সম্পূর্ণ ${claimable}৳ লিখুন`, `Enter full ${claimable}৳`)}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl p-3 border border-emerald/40 bg-emerald/10">
          <p className="text-[10px] font-black text-emerald">💚 {t("মেইন ব্যালেন্স", "Main balance")}</p>
          <p className="mono-num text-lg font-black" translate="no">{bonusAvailable}৳</p>
           <p className="text-[9px] text-muted-foreground leading-tight">{t("থাকলে যেকোনো দিন তোলা যাবে", "Withdraw any day when available")}</p>
        </div>
        <div className="rounded-2xl p-3 border border-amber/50 bg-amber/10">
          <p className="text-[10px] font-black text-amber">⏳ {t("পেন্ডিং ব্যালেন্স", "Pending balance")}</p>
          <p className="mono-num text-lg font-black" translate="no">{pendingPart}৳</p>
          <p className="text-[9px] text-muted-foreground leading-tight">
            {t("সরাসরি তোলা যায় না — রি-ভেরিফাই থাকা স্লটের টাকা ১ তারিখে মেইনে আসে। ৩ তারিখ রাত ১০টার পর না তোলা টাকা আবার পেন্ডিংয়ে ফেরে।", "Not withdrawable directly — verified slots move to main on the 1st; unwithdrawn mining returns to pending after the 3rd, 10 PM.")}
          </p>

        </div>
      </div>



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


      {/* Payout method: bKash / Nagad (BDT) only */}
      <div className="grid grid-cols-1 gap-2" translate="no">
          <div
            className="h-auto justify-start relative overflow-hidden rounded-2xl p-3.5 border-2 text-left border-rose bg-rose/10 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              <img src={bkashLogo} alt="bKash" className="h-7 w-7 rounded-full object-contain bg-white border border-white shadow" loading="lazy" />
              <img src={nagadLogo} alt="Nagad" className="h-7 w-7 rounded-full object-contain bg-white border border-white shadow" loading="lazy" />
            </div>
            <div>
              <p className="text-sm font-black text-rose">BDT</p>
              <p className="text-[9px] text-muted-foreground">{t("বিকাশ / নগদ", "bKash / Nagad")}</p>
            </div>
          </div>
          </div>
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
            <WithdrawLockedCard
              monthlyWindow={monthlyWindow}
              adminWithdrawOff={adminWithdrawOff}
              min={MIN_WITHDRAW_BDT}
              t={t}
            />
          ) : provider && chosenWallet && chosenEnabled ? (
            <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="premium-panel rounded-2xl p-4 space-y-4" data-voice="withdraw.intro">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <CalendarDays className="h-4 w-4 text-primary" />
                <p className="text-xs font-black">টাকার পরিমাণ লিখুন</p>
                <span className="ml-auto text-[9px] font-bold text-muted-foreground">সর্বোচ্চ {claimable}৳</span>
              </div>
              <div data-voice="withdraw.amount">
                <label className="text-[10px] text-muted-foreground font-bold">{t("কত টাকা তুলতে চান?", "How much do you want to withdraw?")}</label>
                <div className="relative mt-2">
                  <input type="number" min={MIN_WITHDRAW_BDT} max={claimable} step="1" value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder={t("নিজে পরিমাণ লিখুন", "Enter amount")}
                    className="w-full px-4 py-3.5 pr-12 mono-num bg-surface-2 border-2 border-border rounded-xl text-xl font-black outline-none focus:border-primary" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-muted-foreground">৳</span>
                </div>
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
              <Button disabled={withdrawClosed || mut.isPending || !amountValid}
                data-voice="withdraw.submit"
                className="w-full h-auto py-4 rounded-xl gradient-cta font-black text-base disabled:opacity-40">
                {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {withdrawClosed ? "উইথড্র সাময়িক বন্ধ" : !amountValid ? "পরিমাণ লিখুন" : t("উইথড্র রিকোয়েস্ট করুন", "Submit withdraw request")}
              </Button>
            </form>
          ) : null}
        </>
      ) : !store ? (
        <UsdtWithdrawCard
          claimable={claimable}
          amount={amount} setAmount={setAmount}
          usdtAddress={usdtAddress}
          usdtRate={usdtRate}
          usdtEnabled={usdtEnabled}
          usdtOffMsg={usdtOffMsg}
          onSubmit={() => mut.mutate()}
          submitting={mut.isPending}
          closed={withdrawClosed}
          monthlyWindow={monthlyWindow}
          adminWithdrawOff={adminWithdrawOff}
          t={t}
        />
      ) : null}


      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{t("ইতিহাস", "History")}</p>
          <div className="flex gap-1 rounded-full bg-surface-2 p-0.5" translate="no">
            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose text-white shadow">
              BDT
            </span>
          </div>
        </div>
        <div className="space-y-2">
          {(() => {
            const filteredHistory = (history ?? []).filter((w: any) => w.provider !== "usdt");
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
      className={`h-auto w-full justify-start rounded-2xl p-3 border-2 text-left transition ${
        selected
          ? tone === "rose" ? "border-rose bg-rose/10 shadow-md" : "border-amber bg-amber/10 shadow-md"
          : "border-border bg-surface-2"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img src={logo} alt={label} className="h-10 w-10 rounded-xl object-contain shrink-0 bg-background shadow-sm" loading="lazy" />
          <span className={`text-sm font-black ${tone === "rose" ? "text-rose" : "text-amber"} truncate`} translate="no">{label}</span>
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
      <Button
        variant="outline"
        type="button"
        onClick={() => { navigator.clipboard.writeText(d.payment_number); toast.success(t("Agent নম্বর কপি হয়েছে", "Agent number copied")); }}
        className="w-full flex items-center justify-between gap-2 bg-amber/10 border border-amber/40 rounded-lg px-3 py-2.5">
        <div className="text-left">
          <p className="text-[9px] uppercase tracking-widest text-amber font-black">{t("Cash-Out এই নাম্বারে", "Cash-Out to this number")}</p>
          <p className="mono-num font-black text-lg text-navy" translate="no">{d.payment_number}</p>
        </div>
        <Copy className="w-4 h-4 text-amber" />
    </Button>
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

function WithdrawLockedCard({ monthlyWindow, adminWithdrawOff, min, t }: {
  monthlyWindow: { isOpen: boolean; msUntilOpen: number };
  adminWithdrawOff: boolean;
  min: number;
  t: (bn: string, en: string) => string;
}) {
  if (adminWithdrawOff) {
    return (
      <div className="rounded-2xl border-2 border-amber/40 bg-amber/10 p-4 text-center">
        <p className="text-sm font-bold text-amber">⏸️ {t("উইথড্র সাময়িকভাবে বন্ধ", "Withdraw is temporarily paused")}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{t("একটু পরে আবার চেষ্টা করুন", "Please try again a little later")}</p>
      </div>
    );
  }
  if (!monthlyWindow.isOpen) {
    const ms = monthlyWindow.msUntilOpen;
    const d = Math.floor(ms / 86_400_000);
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    const mnt = Math.floor((ms % 3_600_000) / 60_000);
    return (
      <div className="rounded-2xl border-2 border-cyan/40 bg-cyan/10 p-5 text-center">
        <p className="text-2xl">⏰</p>
        <p className="mt-1 text-sm font-black">{t("বোনাস ছাড়া উইথড্র খোলে প্রতি মাসের ১ তারিখে", "Besides bonus funds, withdrawal opens on the 1st of every month")}</p>
        <p className="mono-num mt-1.5 text-base font-black text-cyan" translate="no">
          {d > 0 ? `${d} ${t("দিন", "d ")} ` : ""}{h} {t("ঘণ্টা", "h ")} {mnt} {t("মিনিট বাকি", "min left")}
        </p>
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
          {t("মাইনিং ব্যালেন্স ১ তারিখ থেকে ৩ তারিখ রাত ১০টা পর্যন্ত তোলা যায়। এর বাইরে টাকা আপনার হিসাবে জমা থেকে যায়।", "Mining balance can be withdrawn from the 1st through the 3rd at 10 PM. Outside that, the money stays safe in your account.")}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-rose/30 bg-rose/10 p-4 text-center">
      <Lock className="w-6 h-6 text-rose mx-auto mb-1" />
      <p className="text-sm font-bold text-rose">{t("পর্যাপ্ত ব্যালেন্স নেই", "Not enough balance")}</p>
      <p className="text-[11px] text-muted-foreground mt-1" translate="no">{t(`সর্বনিম্ন ${min}৳ হলে উইথড্র করা যাবে`, `Withdraw needs at least ${min}৳`)}</p>
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
  monthlyWindow: { isOpen: boolean; msUntilOpen: number };
  adminWithdrawOff: boolean;
  t: (bn: string, en: string) => string;
}) {
  const { claimable, amount, setAmount, usdtAddress, setUsdtAddress, usdtRate, usdtEnabled, usdtOffMsg, onSubmit, submitting, closed, monthlyWindow, adminWithdrawOff, t } = props;
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
      <WithdrawLockedCard monthlyWindow={monthlyWindow} adminWithdrawOff={adminWithdrawOff} min={MIN_WITHDRAW_BDT} t={t} />
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
  const store = isStoreBuild();
  return (
    <div className="glass rounded-2xl border border-gold/25 p-3">
      <p className="text-[12px] font-black">
        <span className="mr-1 text-base leading-none">{region.flag}</span>
        {t("আপনার দেশ", "Your country")}: {region.nameLocal} ({countryCode}) · {region.currency} {region.symbol}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {countryCode === "BD" || store
          ? t(
              "বিকাশ বা নগদে টাকা পাঠানো হয়। রিওয়ার্ড ব্যালান্স নির্ধারিত সময়ে এবং মেইন ব্যালান্স নিয়ম অনুযায়ী তোলা যায়।",
              "Payouts are sent to bKash or Nagad according to the displayed balance and schedule."
            )
          : t(
              "আপনার দেশে লোকাল পেমেন্ট না থাকলে USDT (Celo) ওয়ালেটে পেমেন্ট নিতে পারবেন — ব্যালান্স ৳-এ দেখানো হয়, পাঠানোর সময় USDT-তে রূপান্তর হয়।",
              "If local payout is not available in your country, you can be paid in USDT (Celo) — balance is shown in ৳ and converted to USDT when paid."
            )}
      </p>
      <p className="mt-1 text-[11px] font-black text-gold">
        {t("মাইনিং টাকা তুলতে আগে ক্লেইম করে পেন্ডিং ব্যালান্সে নিন।", "Claim mining into pending balance before withdrawing.")}
      </p>
    </div>
  );
}
