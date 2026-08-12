import { useQuery } from "@tanstack/react-query";
import { Download, Smartphone } from "lucide-react";
import { getAppStatus } from "@/lib/app-status.functions";

/**
 * অ্যান্ড্রয়েড APK ডাউনলোড কার্ড।
 * Admin → বোনাস সেটিংস থেকে APK লিংক দিলেই সব ইউজারের সামনে দেখাবে।
 * Play Store-এ published হলে ওই লিংকটাই বসিয়ে দিলে সেখান থেকেই ডাউনলোড হবে।
 */
export function ApkDownloadCard({ compact = false }: { compact?: boolean }) {
  const { data } = useQuery({
    queryKey: ["app-status-apk"],
    queryFn: () => getAppStatus(),
    staleTime: 5 * 60 * 1000,
  });

  const url = (data as any)?.apkUrl as string | null | undefined;
  if (!url) return null;

  const version = (data as any)?.apkVersion as string | null | undefined;
  const isStore = /play\.google\.com/i.test(url);

  return (
    <a
      href={url}
      {...(isStore
        ? { target: "_blank", rel: "noopener noreferrer" }
        : { download: "Good-App.apk" })}
      className={`block rounded-2xl border-2 border-emerald/40 bg-gradient-to-r from-emerald/15 via-cyan/10 to-transparent p-3 btn-press ${compact ? "" : "shadow-lg"}`}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 w-11 h-11 rounded-xl bg-emerald/20 grid place-items-center">
          {isStore ? <Smartphone className="w-5 h-5 text-emerald" /> : <Download className="w-5 h-5 text-emerald animate-bounce" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest font-black text-emerald">
            {isStore ? "Google Play" : "Android App"}
          </p>
          <p className="text-sm font-black text-navy leading-tight">
            {isStore ? "Play Store থেকে অ্যাপ ইনস্টল করুন" : "📥 অ্যাপ ডাউনলোড করুন (এক ট্যাপে)"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isStore
              ? "এক ট্যাপে ইনস্টল — অটো আপডেট পাবেন"
              : `ফোনে ইনস্টল করে সহজে ব্যবহার করুন${version ? ` • v${version}` : ""}`}
          </p>
        </div>
        <span className="shrink-0 px-3 py-1.5 rounded-lg gradient-emerald text-[11px] font-black">
          {isStore ? "OPEN" : "ডাউনলোড"}
        </span>
      </div>
      {!isStore && (
        <p className="text-[9px] text-muted-foreground mt-2 leading-snug">
          ইনস্টল না হলে: Settings → Security → "Install unknown apps" চালু করুন।
        </p>
      )}
    </a>
  );
}
