import { useQuery } from "@tanstack/react-query";
import { Download, Smartphone, Zap, BellRing, ShieldCheck } from "lucide-react";
import { getAppStatus } from "@/lib/app-status.functions";
import { isNativeApp } from "@/lib/native-google";

/**
 * অ্যান্ড্রয়েড অ্যাপ ডাউনলোড কার্ড — বড়, ইউনিক ডিজাইন।
 * ট্যাপ করলেই সোজা ডাউনলোড শুরু (কোনো নোটিশ/পপআপ নেই)।
 * নেটিভ অ্যাপের ভিতরে থাকলে দেখানো হয় না।
 */
export function ApkDownloadCard({ compact = false }: { compact?: boolean }) {
  const { data } = useQuery({
    queryKey: ["app-status-apk"],
    queryFn: () => getAppStatus(),
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    enabled: typeof window !== "undefined" && !isNativeApp(),
  });

  const url = (data as any)?.apkUrl as string | null | undefined;
  if (!url || isNativeApp()) return null;

  const version = (data as any)?.apkVersion as string | null | undefined;
  const isStore = /play\.google\.com/i.test(url);

  return (
    <div
      className={`relative overflow-hidden rounded-[26px] border border-white/15 p-4 ${compact ? "" : "shadow-2xl"}`}
      style={{ background: "linear-gradient(160deg,#0b1224 0%,#141c40 55%,#1d1046 100%)" }}
    >
      <div
        className="pointer-events-none absolute -top-14 -right-10 h-40 w-40 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle,#06b6d4,transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle,#a855f7,transparent 70%)" }}
      />

      <div className="relative flex items-center gap-3 text-white">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl shadow-lg"
          style={{ background: "linear-gradient(135deg,#22c55e,#06b6d4)" }}
        >
          {isStore ? (
            <Smartphone className="h-7 w-7" />
          ) : (
            <Download className="h-7 w-7 animate-bounce" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
            {isStore ? "Google Play" : "Official Android App"}
          </p>
          <p className="text-base font-black leading-tight">
            Good-App {isStore ? "ইনস্টল করুন" : "অ্যাপটি ডাউনলোড করুন"}
          </p>
          <p className="text-[11px] text-white/70">
            ওয়েবসাইটের চেয়ে অনেক দ্রুত{version && !isStore ? ` • v${version}` : ""}
          </p>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2">
        {[
          { icon: <Zap className="h-4 w-4 text-amber-300" />, t: "সুপার ফাস্ট" },
          { icon: <BellRing className="h-4 w-4 text-cyan-300" />, t: "নোটিফিকেশন" },
          { icon: <ShieldCheck className="h-4 w-4 text-emerald-300" />, t: "১০০% নিরাপদ" },
        ].map((f) => (
          <div key={f.t} className="rounded-xl bg-white/10 p-2 text-center">
            <div className="flex justify-center">{f.icon}</div>
            <p className="mt-1 text-[10px] font-black text-white/85">{f.t}</p>
          </div>
        ))}
      </div>

      <a
        href={url}
        {...(isStore
          ? { target: "_blank", rel: "noopener noreferrer" }
          : { download: `Good-App-v${version || "latest"}.apk` })}
        className="relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 text-base font-black text-white btn-press"
        style={{
          background: "linear-gradient(100deg,#f59e0b 0%,#ef4444 40%,#a855f7 75%,#06b6d4 100%)",
        }}
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2.2s_linear_infinite]" />
        <Download className="relative h-5 w-5" />
        <span className="relative">
          {isStore ? "Play Store থেকে ইনস্টল করুন" : "এখনই অ্যাপ ডাউনলোড করুন"}
        </span>
      </a>
    </div>
  );
}
