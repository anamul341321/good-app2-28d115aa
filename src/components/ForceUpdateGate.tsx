import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { getAppStatus } from "@/lib/app-status.functions";
import { isNativeApp } from "@/lib/native-google";
import { Button } from "@/components/ui/button";

/**
 * বাধ্যতামূলক আপডেট গেট।
 * ইনস্টল করা ভার্সন Admin Panel-এর "Minimum App Version"-এর চেয়ে পুরোনো হলে
 * পুরো অ্যাপ ব্লক হয়ে যায় — আপডেট ছাড়া কিছুই ব্যবহার করা যাবে না।
 * Website-এও চালু করা যায় (force_update_web) — তখন ওয়েব ইউজারকে অ্যাপ
 * ডাউনলোড করতেই হবে।
 */

function parseVer(v: string | null | undefined): number[] | null {
  if (!v) return null;
  const m = String(v).match(/\d+(?:\.\d+)*/);
  if (!m) return null;
  return m[0].split(".").map((n) => parseInt(n, 10) || 0);
}

function isOlder(installed: string | null, required: string | null | undefined): boolean {
  const a = parseVer(installed);
  const b = parseVer(required);
  if (!a || !b) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

export function ForceUpdateGate() {
  const native = typeof window !== "undefined" && isNativeApp();
  const [installed, setInstalled] = useState<string | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!native) return;
    const read = () =>
      import("@capacitor/app")
        .then((m) => m.App.getInfo())
        .then((info) => setInstalled(info?.version ?? null))
        .catch(() => setInstalled(null));
    void read();
    let remove: (() => void) | undefined;
    import("@capacitor/app")
      .then(async (m) => {
        const handle = await m.App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) void read();
        });
        remove = () => handle.remove();
      })
      .catch(() => {});
    return () => remove?.();
  }, [native]);

  const { data } = useQuery({
    queryKey: ["app-status-force-update"],
    queryFn: () => getAppStatus(),
    staleTime: 30 * 1000,
    refetchOnMount: "always",
  });

  const status = data as any;
  const required: string | null = status?.minAppVersion ?? status?.apkVersion ?? null;
  const url: string | null = status?.apkUrl ?? null;
  const enabled: boolean = status?.forceUpdate === true;
  const webEnabled: boolean = status?.forceUpdateWeb === true;
  const message: string = status?.forceUpdateMessage ?? "";

  // অ্যাডমিন প্যানেল কখনোই ব্লক হবে না
  const isAdmin = typeof path === "string" && /^\/admin(-login)?(\/|$)/.test(path);
  const isSocialRoute = /^\/(social|chat|feed|friends|videos|reels|watch|studio|channel|user)(\/|$)/.test(path);

  const blocked =
    enabled &&
    !isAdmin &&
    !isSocialRoute &&
    (native ? isOlder(installed, required) : webEnabled && !!required);

  // ব্লক থাকলে পেজ স্ক্রল বন্ধ
  useEffect(() => {
    if (!blocked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [blocked]);

  if (!blocked) return null;

  const absolute = url
    ? /^https?:\/\//i.test(url)
      ? url
      : `https://www.goodapp2.live${url.startsWith("/") ? url : `/${url}`}`
    : null;

  const startUpdate = () => {
    if (!absolute) {
      toast.error("আপডেট লিংক পাওয়া যাচ্ছে না — কিছুক্ষণ পর আবার চেষ্টা করুন");
      return;
    }
    const permalink = `${absolute}${absolute.includes("?") ? "&" : "?"}download=${Date.now()}`;
    const nativeOpener = (
      window as Window & { GoodAppDownloader?: { openExternal?: (url: string) => void } }
    ).GoodAppDownloader;
    try {
      if (nativeOpener?.openExternal) {
        nativeOpener.openExternal(permalink);
        toast.success("Chrome-এ ডাউনলোড শুরু হচ্ছে — শেষ হলে Install দিন", { duration: 8000 });
        return;
      }
    } catch {
      // fall through
    }
    try {
      const opened = window.open(permalink, "_blank");
      if (!opened) window.location.href = permalink;
    } catch {
      window.location.href = permalink;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] grid place-items-center p-5"
      style={{ background: "linear-gradient(160deg,#050914 0%,#0b1224 55%,#1b0b34 100%)" }}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-white/5 p-6 text-center shadow-2xl backdrop-blur-xl">
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl"
          style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
        >
          <ShieldAlert className="h-8 w-8 text-white" />
        </div>
        <h1 className="mt-4 text-lg font-black text-white">আপডেট বাধ্যতামূলক</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/75">{message}</p>
        <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-[12px] font-bold text-white/85">
          {native ? (
            <>
              আপনার ভার্সন: <span className="text-red-300">v{installed ?? "?"}</span>
              <br />
              প্রয়োজন: <span className="text-cyan-300">v{required}</span> বা তার উপরে
            </>
          ) : (
            <>
              সর্বশেষ অ্যাপ ভার্সন: <span className="text-cyan-300">v{required}</span>
              <br />
              সব সার্ভিস ব্যবহার করতে অ্যাপটি ইনস্টল/আপডেট করুন
            </>
          )}
        </div>
        <Button
          type="button"
          onClick={startUpdate}
          className="mt-5 h-auto w-full rounded-2xl py-3 text-sm font-black text-white btn-press"
          style={{ background: "linear-gradient(100deg,#22c55e,#06b6d4 60%,#a855f7)" }}
        >
          <span className="flex items-center justify-center gap-2">
            <Download className="h-4 w-4" /> এখনই আপডেট করুন
          </span>
        </Button>
        <p className="mt-3 text-[11px] text-white/50">
          আপডেট শেষ করে অ্যাপটি আবার খুললেই সবকিছু স্বাভাবিকভাবে চলবে।
        </p>
      </div>
    </div>
  );
}
