import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyReferrals } from "@/lib/referral.functions";
import { Copy, Share2, Users, Gift, CheckCircle2, Clock, Loader2, Sparkles, Crown, TrendingUp, Coins } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { PageVoice } from "@/components/PageVoice";
import { VideoTutorialButton } from "@/components/VideoTutorialButton";

export const Route = createFileRoute("/_authenticated/referral")({
  ssr: false,
  component: ReferralPage,
});

function ReferralPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["referrals"],
    queryFn: () => getMyReferrals(),
    refetchInterval: 30_000,
  });

  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined" && data?.referralCode) {
      setShareUrl(`${window.location.origin}/auth?ref=${data.referralCode}`);
    }
  }, [data?.referralCode]);

  if (isLoading || !data) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan" /></div>;
  }

  const code = data.referralCode ?? "—";
  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} কপি হয়েছে ✨`);
  };
  const buildShareText = (withUrl: boolean) => {
    const lines = [
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
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "good-app — মাসে ৫০০৳ আয়",
          text: buildShareText(false),
          url: shareUrl,
        });
        return;
      } catch {}
    }
    copy(buildShareText(true), "শেয়ার টেক্সট");
  };

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

      {/* 💎 Referral Code Card */}
      <div className="premium-panel rounded-3xl p-5 text-center shimmer-border" data-voice="referral.intro">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">আপনার রেফারেল কোড</p>
        <p className="mono-num text-4xl font-black ref-gradient-text mt-2 tracking-widest">{code}</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={() => copy(code, "কোড")} data-voice="referral.copy"
            className="py-3 rounded-xl gradient-cta font-black text-xs flex items-center justify-center gap-1.5 btn-press">
            <Copy className="w-3.5 h-3.5" /> কোড কপি
          </button>
          <button onClick={share} data-voice="referral.bonus"
            className="py-3 rounded-xl gradient-emerald font-black text-xs flex items-center justify-center gap-1.5 btn-press pulse-glow">
            <Share2 className="w-3.5 h-3.5" /> এখনই শেয়ার
          </button>
        </div>
        {shareUrl && (
          <button onClick={() => copy(shareUrl, "লিংক")}
            className="mt-2 w-full py-2 rounded-lg bg-surface-2 border border-border text-[11px] text-navy/80 font-bold truncate">
            🔗 {shareUrl}
          </button>
        )}
      </div>

      {/* 📊 Colourful Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={<Users className="w-5 h-5" />} label="মোট রেফার" value={data.totalReferred} tone="cyan" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="বোনাস সক্রিয়" value={data.qualifiedCount} tone="emerald" />
        <StatCard icon={<Coins className="w-5 h-5" />} label="মাসিক বোনাস" value={`+${data.qualifiedCount * 50}৳`} tone="amber" />
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
            <p className="mono-num font-black text-2xl">{(data as any).activeReferees ?? 0}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-95">অ্যাকাউন্ট খুলেছে</p>
          </div>
          <div className="rounded-2xl bg-white/20 backdrop-blur border border-white/25 p-2.5 text-center">
            <p className="mono-num font-black text-2xl">{(data as any).totalVerifies ?? 0}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-95">মোট ভেরিফাই</p>
          </div>
          <div className="rounded-2xl bg-white/20 backdrop-blur border border-white/25 p-2.5 text-center">
            <p className="mono-num font-black text-2xl">{data.totalReferred - ((data as any).activeReferees ?? 0)}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-95">এখনো শুরু করেনি</p>
          </div>
        </div>
        <p className="relative text-[10px] mt-2.5 opacity-95 leading-snug">
          ✨ সবাই মিলে <b className="mono-num">{(data as any).totalVerifies ?? 0}</b> ভেরিফাই করেছেন।
          কেউ ১০/১০ পূর্ণ করলেই আপনি প্রতি মাসে <b>+৫০৳</b> পাবেন আজীবন।
        </p>
      </div>


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
          {data.referees.map((r, i) => (
            <li key={r.id} className={`rounded-2xl p-3 border transition ${r.qualified ? "border-emerald/40 bg-linear-to-br from-emerald/10 to-cyan/5" : "border-border bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black ${r.qualified ? "bg-emerald text-white" : "bg-surface-2 text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-sm text-navy truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground mono-num">{r.phone}</p>
                  </div>
                </div>
                {r.qualified ? (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald text-white px-2.5 py-1 text-[10px] font-black shadow-sm">
                    <CheckCircle2 className="w-3 h-3" /> +৫০৳/মাস
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber/15 text-amber px-2.5 py-1 text-[10px] font-black">
                    <Clock className="w-3 h-3" /> {r.validDone}/10
                  </span>
                )}
              </div>
              {!r.qualified && (
                <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full gradient-emerald transition-all" style={{ width: `${(r.validDone / 10) * 100}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
        <button onClick={() => refetch()} className="mt-3 w-full text-[11px] text-muted-foreground underline">রিফ্রেশ</button>
      </div>

      <div className="text-center">
        <Link to="/home" className="text-[11px] text-cyan font-bold underline">← হোমে ফিরুন</Link>
      </div>
    </div>
  );
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
