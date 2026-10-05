import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { detectNativeCallsApp } from "@/lib/calls-app";

const ENDPOINT = "https://www.goodapp2.live/api/public/app/download?calls=1";

/** মূল অ্যাপ থেকে আলাদা "GoodApp Call" APK নামানোর বাটন। কল অ্যাপে দেখায় না। */
export function CallsAppDownloadButton({ className = "" }: { className?: string }) {
  const [version, setVersion] = useState<string | null>(null);
  const [hidden, setHidden] = useState(() => detectNativeCallsApp());

  useEffect(() => {
    if (detectNativeCallsApp()) {
      setHidden(true);
      return;
    }
    setHidden(false);
    fetch(`/api/public/app/download?calls=1&resolve=1&t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.version && setVersion(String(d.version)))
      .catch(() => {});
  }, []);

  if (hidden) return null;

  const start = () => {
    const link = `${ENDPOINT}&download=${Date.now()}`;
    const native = (window as any).GoodAppDownloader;
    toast.success("Chrome-এ ডাউনলোড শুরু হচ্ছে — শেষ হলে ফাইলে ট্যাপ করে Install দিন", { duration: 8000 });
    try {
      if (native?.openExternal) {
        native.openExternal(link);
        return;
      }
    } catch {
      /* fall through */
    }
    const w = window.open(link, "_blank");
    if (!w) window.location.href = link;
  };

  return (
    <button
      type="button"
      onClick={start}
      className={`gradient-cyan flex w-full items-center justify-center gap-2 rounded-2xl p-4 text-sm font-black ${className}`}
    >
      <Smartphone className="h-5 w-5" />
      {version ? `GoodApp Call অ্যাপ ডাউনলোড করুন (v${version})` : "GoodApp Call অ্যাপ ডাউনলোড করুন"}
    </button>
  );
}
