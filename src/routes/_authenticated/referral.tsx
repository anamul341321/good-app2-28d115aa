import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyReferrals } from "@/lib/referral.functions";
import { Copy, Share2, Users, Gift, CheckCircle2, Clock, Loader2, Sparkles, Crown, TrendingUp, Coins, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { PageVoice } from "@/components/PageVoice";
import { VideoTutorialButton } from "@/components/VideoTutorialButton";
import { isLiteBuild } from "@/lib/lite-build";

export const Route = createFileRoute("/_authenticated/referral")({
  ssr: false,
  component: ReferralPage,
});

function ReferralPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["referrals", "verified-status-v3"],
    queryFn: () => getMyReferrals(),
    refetchInterval: 60_000,
    refetchOnMount: "always",
    staleTime: 15_000,
    retry: 2,
  });

  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined" && data?.referralCode && data.lock?.unlocked) {
      setShareUrl(`${window.location.origin}/auth?ref=${data.referralCode}`);
    } else {
      setShareUrl("");
    }
  }, [data?.referralCode, data?.lock?.unlocked]);

  if (isError && !data) {
    return (
      <div className="py-16 text-center space-y-4 px-6">
        <div className="w-16 h-16 rounded-full bg-rose/15 text-rose flex items-center justify-center mx-auto text-3xl">😕</div>
        <div>
          <p className="text-lg font-black text-navy">রেফার পেজ লোড হয়নি</p>
          <p className="text-sm text-muted-foreground mt-1">ইন্টারনেট চেক করে আবার চেষ্টা করুন। বার বার হলে অ্যাপ রিফ্রেশ দিন।</p>
          <p className="text-[10px] text-muted-foreground mt-1 break-all">{(error as any)?.message ?? ""}</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="mx-auto px-6 py-3 rounded-2xl gradient-cta font-black text-white shadow-lg btn-press disabled:opacity-60">
          {isFetching ? "লোড হচ্ছে…" : "🔄 আবার চেষ্টা করুন"}
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan" /></div>;
  }

  const code = data.referralCode ?? "—";
  const lock = (data as any).lock as { unlocked: boolean; override: boolean; firstVerifies: number; needed: number } | undefined;
  const isLocked = lock ? !lock.unlocked : false;

  const copy = (txt: string, label: string) => {
    if (isLocked) {
        toast.error(`🔒 Referral link এখনো lock — ${lock?.needed ?? 5}টি ফেস ভেরিফাই complete করুন`);
      return;
    }
    navigator.clipboard.writeText(txt);
    toast.success(`${label} কপি হয়েছে ✨`);
  };
  const buildShareText = (withUrl: boolean) => {
    const lines = isLiteBuild() ? [
      "Good-App-এ আমার সাথে যুক্ত হোন!",
      "",
      "মেসেঞ্জার, রিলস, স্টোরি ও কমিউনিটি ফিচার ব্যবহার করুন।",
      "",
      `আমার ইনভাইট কোড: ${code}`,
    ] : [
      "🎁 আসসালামু আলাইকুম!",
      "",
      "আমি good-app ব্যবহার করছি — শুধু ফেস ভেরিফাই করেই প্রতি মাসে ৫০০৳ পর্যন্ত আয় করা যায়। ১০০% ফ্রি, কোনো ইনভেস্ট নেই।",
      "",
      "✨ আমার রেফারেল কোড দিয়ে জয়েন করলে আপনি ও আমি — দুজনেই বোনাস পাব।",
      "",
      `🔐 রেফারেল কোড: ${code}`,
    ];
    if (withUrl) lines.push("", "👇 এখনই শুরু করুন:", shareUrl);
    return lines.join("\n");
  };
  const share = async () => {
    if (isLocked) {
      toast.error(`🔒 Referral link এখনো lock — ${lock?.needed ?? 5}টি ফেস ভেরিফাই complete করুন`);
      return;
    }
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: isLiteBuild() ? "Good-App-এ আমার সাথে যুক্ত হোন" : "good-app — মাসে ৫০০৳ আয়",
          text: buildShareText(false),
          url: shareUrl,
        });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(buildShareText(true));
    toast.success("শেয়ার টেক্সট কপি হয়েছে ✨");
  };

  if (isLiteBuild()) {
    return (
      <div className="space-y-5 pt-2 pb-8">
        <div className="relative overflow-hidden rounded-3xl p-6 text-center text-white shadow-2xl" style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1,#8b5cf6)" }}>
          <Users className="mx-auto h-12 w-12" />
          <h1 className="mt-3 text-2xl font-black">বন্ধুদের আমন্ত্রণ জানান</h1>
          <p className="mt-2 text-sm font-bold text-white/90">Good-App কমিউনিটিতে বন্ধুদের সাথে মেসেজ, রিলস ও স্টোরি শেয়ার করুন।</p>
        </div>
        {lock && isLocked ? (
          <div className="rounded-3xl border border-border bg-surface p-5 text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 font-black text-navy">ইনভাইট লিংক এখনো লক</p>
            <p className="mt-1 text-xs text-muted-foreground">অ্যাকাউন্ট যাচাই সম্পন্ন হলে ইনভাইট লিংক চালু হবে।</p>
          </div>
        ) : (
          <div className="premium-panel rounded-3xl p-5 text-center">
            <p className="text-xs font-bold text-muted-foreground">আপনার ইনভাইট কোড</p>
            <p className="mono-num mt-2 text-4xl font-black text-violet">{code}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => copy(code, "কোড")} className="rounded-xl gradient-cta py-3 text-xs font-black"><Copy className="mr-1 inline h-4 w-4" />কোড কপি</button>
              <button onClick={share} className="rounded-xl gradient-emerald py-3 text-xs font-black"><Share2 className="mr-1 inline h-4 w-4" />শেয়ার করুন</button>
            </div>
          </div>
        )}
        <div className="premium-panel rounded-3xl p-5">
          <h2 className="font-black text-navy">আপনার আমন্ত্রণ তালিকা</h2>
          <p className="mt-1 text-xs text-muted-foreground">মোট {data.totalReferred} জন বন্ধু যুক্ত হয়েছেন</p>
          <ul className="mt-3 space-y-2">
            {data.referees.map((r, i) => <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-white p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-violet/10 text-xs font-black text-violet">{i + 1}</span><div><p className="text-sm font-black text-navy">{r.name}</p><p className="text-[10px] text-muted-foreground">UID {r.uid}</p></div></li>)}
            {data.referees.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">এখনো কোনো বন্ধু যুক্ত হননি।</li>}
          </ul>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-5 pt-2 pb-8">
      <PageVoice pageId="referral" steps={["referral.intro","referral.bonus"]} />

      {/* 🌟 Premium Animated Hero */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white ref-hero shadow-2xl">
        <span className="ref-sparkle" style={{ top: "12%", left: "18%" }} />
        <span className="ref-sparkle" style={{ top: "30%", right: "14%", animationDelay: "0.6s" }} />
        <span className="ref-sparkle" style={{ bottom: "20%", left: "40%", animationDelay: "1.1s" }} />
        <span className="ref-sparkle" style={{ bottom: "10%", right: "22%", animationDelay: "0.3s" }} />

        <div className="relative text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-[10px] font-black tracking-wider mb-3">
            <Crown className="w-3 h-3" /> LIFETIME BONUS · প্রিমিয়াম
          </div>
          <div className="ref-coin inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/25 backdrop-blur-md shadow-xl mb-2">
            <Gift className="w-9 h-9 text-white drop-shadow-lg" />
          </div>
          <h1 className="text-2xl font-black leading-tight drop-shadow">
            রেফার করুন <br />
            <span className="text-yellow-200">১০% আজীবন বোনাস 🎉</span>
          </h1>
          <p className="text-[12px] mt-2 text-white/95 leading-relaxed px-2">
            আপনার বন্ধু <b>১০টি ঘর ভেরিফাই</b> করলেই, আপনি প্রতি মাসে তাঁর জন্য
            <b className="text-yellow-200"> +৫০ টাকা </b>
            আজীবন পাবেন — মাইনিং কাউন্টারে লাইভ যোগ হবে।
          </p>
        </div>
      </div>

      <VideoTutorialButton />

      {/* 🔒 Lock banner */}
      {lock && (
        <div className={`rounded-3xl p-4 border-2 shadow-lg ${
          isLocked ? "border-rose/40 bg-linear-to-br from-rose/15 to-amber/10"
                    : "border-emerald/40 bg-linear-to-br from-emerald/15 to-cyan/10"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center ${isLocked ? "bg-rose text-white" : "bg-emerald text-white"}`}>
              {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`font-black text-sm ${isLocked ? "text-rose" : "text-emerald"}`}>
                {isLocked ? "🔒 আপনার রেফার লিংক এখনো Lock" : "🔓 রেফার লিংক Unlock — এখন শেয়ার করুন!"}
              </p>
              <p className="text-[11px] text-navy/80 mt-1 leading-snug">
                {isLocked
                  ? <>নিজের <b>{lock.needed}টি ফেস ভেরিফাই</b> সম্পন্ন করলে link auto unlock হবে। এর আগে refer করা যাবে না।</>
                  : lock.override
                    ? <>Admin আপনার link manual unlock করেছেন।</>
                    : <>আপনার {lock.needed}/{lock.needed} complete — link active।</>
                }
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-white/60 overflow-hidden">
                  <div className={`h-full ${isLocked ? "bg-rose" : "bg-emerald"} transition-all`}
                       style={{ width: `${Math.min(100, (lock.firstVerifies / lock.needed) * 100)}%` }} />
                </div>
                <span className="mono-num text-[11px] font-black text-navy">{lock.firstVerifies}/{lock.needed}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💎 Referral Code Card — code/link stay hidden until unlocked. */}
      <div className="premium-panel rounded-3xl p-5 text-center shimmer-border relative" data-voice="referral.intro">
        {isLocked ? (
          <div className="py-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose/15 text-rose flex items-center justify-center">
              <Lock className="w-7 h-7" />
            </div>
            <p className="mt-3 font-black text-navy">কোড ও রেফার লিংক লক আছে</p>
            <p className="mt-1 text-[11px] text-muted-foreground">নিজের ৫টি সফল First Verify পূর্ণ হলে এখানে code ও link দেখা যাবে।</p>
          </div>
        ) : (
          <>
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">আপনার রেফারেল কোড</p>
        <p className="mono-num text-4xl font-black ref-gradient-text mt-2 tracking-widest">{code}</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={() => copy(code, "কোড")} disabled={isLocked} data-voice="referral.copy"
            className="py-3 rounded-xl gradient-cta font-black text-xs flex items-center justify-center gap-1.5 btn-press disabled:opacity-50 disabled:cursor-not-allowed">
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} কোড কপি
          </button>
          <button onClick={share} disabled={isLocked} data-voice="referral.bonus"
            className="py-3 rounded-xl gradient-emerald font-black text-xs flex items-center justify-center gap-1.5 btn-press pulse-glow disabled:opacity-50 disabled:cursor-not-allowed">
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />} এখনই শেয়ার
          </button>
        </div>
        {shareUrl && (
          <button onClick={() => copy(shareUrl, "লিংক")} disabled={isLocked}
            className="mt-2 w-full py-2 rounded-lg bg-surface-2 border border-border text-[11px] text-navy/80 font-bold truncate disabled:opacity-50">
            🔗 {shareUrl}
          </button>
        )}
          </>
        )}
      </div>


      {/* 📊 Colourful Stats */}
      {(() => {
        const bonusActiveCount = (data.referees ?? []).filter((r: any) => ((r.reverifies ?? 0) >= 10)).length;
        const monthlyBonusTotal = (data.referees ?? [])
          .filter((r: any) => (r.reverifies ?? 0) >= 10)
          .reduce((s: number, r: any) => s + 50 * refUnits(r), 0);
        return (
        <>
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={<Users className="w-5 h-5" />} label="রেজিস্টার করেছে" value={data.totalReferred} tone="cyan" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="বোনাস সক্রিয়" value={bonusActiveCount} tone="emerald" />
        <StatCard icon={<Coins className="w-5 h-5" />} label="মাসিক বোনাস" value={`+${monthlyBonusTotal}৳`} tone="amber" />
      </div>

      {/* 🔥 Aggregate verification stats */}
      <div className="rounded-3xl p-4 text-white shadow-xl relative overflow-hidden"
           style={{ background: "linear-gradient(120deg,#0ea5e9 0%,#8b5cf6 55%,#ec4899 100%)" }}>
        <div className="absolute -top-10 -right-8 w-32 h-32 rounded-full bg-white/15 blur-2xl" />
        <p className="relative text-[10px] uppercase tracking-[0.25em] font-black opacity-95 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> আপনার রেফার নেটওয়ার্ক
        </p>
        <div className="relative grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-2xl bg-white/20 backdrop-blur border border-white/25 p-2.5 text-center">
             <p className="mono-num font-black text-2xl">{data.totalReferred}</p>
             <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-95">মোট রেজিস্টার</p>
          </div>
          <div className="rounded-2xl bg-white/20 backdrop-blur border border-white/25 p-2.5 text-center">
             <p className="mono-num font-black text-2xl">{(data as any).activeReferees ?? 0}</p>
             <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-95">ফেস সফল ইউজার</p>
          </div>
          <div className="rounded-2xl bg-white/20 backdrop-blur border border-white/25 p-2.5 text-center">
             <p className="mono-num font-black text-2xl">{(data as any).totalFirstVerifies ?? 0}</p>
             <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-95">সফল ফেস ভেরিফাই</p>
          </div>
        </div>
        <p className="relative text-[10px] mt-2.5 opacity-95 leading-snug">
          ✨ আপনার রেফার থেকে <b className="mono-num">{data.totalReferred}</b> জন রেজিস্টার করেছেন, তাঁদের মধ্যে <b className="mono-num">{bonusActiveCount}</b> জন ১০/১০ <b>রি-ভেরিফাই</b> সম্পন্ন করেছেন।
          কেউ ১০/১০ রি-ভেরিফাই পূর্ণ করলেই আপনি প্রতি মাসে <b>+৫০৳</b> পাবেন আজীবন।
        </p>
      </div>
        </>
        );
      })()}


      {/* 🎯 How it works */}
      <div className="premium-panel rounded-3xl p-5">
        <h2 className="font-black text-navy text-sm mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber ref-coin" /> কিভাবে বোনাস পাবেন
        </h2>
        <ol className="space-y-2.5 text-[12px] text-navy/85 leading-relaxed">
          <Step n={1} tone="cyan">উপরের <b>কোড</b> বা <b>লিংক</b> কপি করে বন্ধুকে পাঠান।</Step>
          <Step n={2} tone="violet">বন্ধু সাইন আপ ফর্মে কোডটি বসিয়ে একাউন্ট খুলবেন।</Step>
          <Step n={3} tone="emerald">বন্ধু যখন <b>১০টি ঘর</b> Face Verify সম্পন্ন করবেন — সাথে সাথে আপনার <b className="text-emerald">+১০% আজীবন বোনাস</b> চালু।</Step>
          <li className="rounded-xl bg-amber/10 border border-amber/30 p-2.5 text-[11px] text-amber-900">
            <b className="text-amber">⚠️ মনে রাখুন:</b> Re-verify মিস করলে whitelist হারাবে ও বোনাস বন্ধ হবে। আবার Re-verify করালে বোনাস ফিরে আসবে।
          </li>
        </ol>
      </div>

      {/* 👥 Referral List */}
      <div className="premium-panel rounded-3xl p-5">
        <h2 className="font-black text-navy text-sm mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan" /> আপনার রেফার তালিকা
        </h2>
        {data.referees.length === 0 && (
          <div className="text-center py-8 rounded-2xl bg-surface-2/50 border border-dashed border-border">
            <Gift className="w-8 h-8 mx-auto text-muted-foreground/50 ref-coin" />
            <p className="text-[12px] text-muted-foreground mt-2 px-4">
              এখনো কেউ আপনার কোড ব্যবহার করেননি। <br />
              <b className="text-emerald">এখনই শেয়ার করুন!</b>
            </p>
          </div>
        )}
        <ul className="space-y-2">
          {data.referees.map((r, i) => {
            const reverifies = (r as any).reverifies ?? 0;
            const bonusActive = reverifies >= 10;
            return (
            <li key={r.id} className={`rounded-2xl p-3 border transition ${bonusActive ? "border-emerald/40 bg-linear-to-br from-emerald/10 to-cyan/5" : "border-border bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black ${bonusActive ? "bg-emerald text-white" : "bg-surface-2 text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-sm text-navy truncate">{r.name}</p>
                     <p className="text-[10px] text-muted-foreground mono-num">UID {r.uid} · {r.phone}</p>
                  </div>
                </div>
                {bonusActive ? (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald text-white px-2.5 py-1 text-[10px] font-black shadow-sm">
                    <CheckCircle2 className="w-3 h-3" /> +{50 * refUnits(r)}৳/মাস
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber/15 text-amber px-2.5 py-1 text-[10px] font-black">
                    <Clock className="w-3 h-3" /> রি-ভেরিফাই {reverifies}/10
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald/15 text-emerald font-black text-[10px] mono-num">✅ verify {(r as any).firstVerifies ?? 0}</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan/15 text-cyan font-black text-[10px] mono-num">🔁 re-verify {reverifies}</span>
              </div>

              {!bonusActive && (
                <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full gradient-emerald transition-all" style={{ width: `${Math.min(100, (reverifies / 10) * 100)}%` }} />
                </div>
              )}
            </li>
            );
          })}
        </ul>
        <button onClick={() => refetch()} className="mt-3 w-full text-[11px] text-muted-foreground underline">রিফ্রেশ</button>
      </div>

      <div className="text-center">
        <Link to="/home" className="text-[11px] text-cyan font-bold underline">← হোমে ফিরুন</Link>
      </div>
    </div>
  );
}

// প্রতি ১০টি রি-ভেরিফাই = রেফারির ৫০০৳/মাস স্তর → তার ১০% = ৫০৳ কমিশন
function refUnits(r: any) {
  return Math.max(1, Math.floor((r?.reverifies ?? 0) / 10));
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: any; tone: "cyan" | "emerald" | "amber" | "violet" }) {
  return (
    <div className="premium-panel rounded-2xl p-3 text-center">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-1 bg-${tone}/15 text-${tone}`}>
        {icon}
      </div>
      <p className={`text-xl font-black mono-num text-${tone}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
    </div>
  );
}

function Step({ n, tone, children }: { n: number; tone: "cyan" | "emerald" | "violet"; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 items-start">
      <span className={`shrink-0 w-6 h-6 rounded-full bg-${tone} text-white font-black text-[11px] flex items-center justify-center shadow`}>
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
