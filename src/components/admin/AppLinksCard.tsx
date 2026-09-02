import { useQuery } from "@tanstack/react-query";
import { Copy, Globe, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { adminGetBonusSettings } from "@/lib/admin.functions";

const SITE_URL = "https://www.goodapp2.live";
const DOWNLOAD_URL = `${SITE_URL}/api/public/app/download`;

/**
 * অ্যাডমিন প্যানেলের লিংক বক্স — কেউ লিংক চাইলে এখান থেকেই
 * ওয়েবসাইট লিংক আর সরাসরি অ্যাপ ডাউনলোড লিংক কপি করে পাঠানো যাবে।
 */
export function AppLinksCard() {
  const { data: settings } = useQuery({
    queryKey: ["admin-bonus-settings"],
    queryFn: () => adminGetBonusSettings(),
  });
  const version = (settings as any)?.apk_version as string | null | undefined;

  const copy = (value: string, label: string) => {
    navigator.clipboard?.writeText(value);
    toast.success(`${label} কপি হয়েছে`);
  };

  const rows = [
    {
      icon: <Globe className="w-4 h-4 text-cyan" />,
      title: "ওয়েবসাইট লিংক",
      value: SITE_URL,
      label: "ওয়েবসাইট লিংক",
    },
    {
      icon: <Download className="w-4 h-4 text-cyan" />,
      title: "ডাউনলোড পেজ (শেয়ার করার জন্য সেরা)",
      value: `${SITE_URL}/download`,
      label: "ডাউনলোড পেজ লিংক",
    },
    {
      icon: <Download className="w-4 h-4 text-emerald-500" />,
      title: `সরাসরি APK লিংক${version ? ` (v${version})` : ""}`,
      value: DOWNLOAD_URL,
      label: "ডাউনলোড লিংক",
    },
  ];

  return (
    <div className="rounded-2xl border-2 border-cyan/30 bg-cyan/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Share2 className="w-4 h-4 text-cyan" />
        <p className="font-black text-sm">লিংক শেয়ার বক্স</p>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        কেউ লিংক চাইলে নিচের বাটনে ট্যাপ করে কপি করে পাঠিয়ে দিন। ডাউনলোড লিংকটি সবসময়{" "}
        <b>সর্বশেষ আপলোড করা APK</b> দেয়, তাই লিংক কখনো পুরোনো হয় না।
      </p>

      {rows.map((r) => (
        <div
          key={r.title}
          className="rounded-xl border border-border bg-background p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            {r.icon}
            <p className="text-[11px] font-black">{r.title}</p>
          </div>
          <p className="text-[11px] font-bold break-all text-muted-foreground">{r.value}</p>
          <div className="flex gap-2">
            <button
              onClick={() => copy(r.value, r.label)}
              className="flex-1 py-2 rounded-lg bg-surface-2 border border-border text-[11px] font-black btn-press flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> কপি
            </button>
            <a
              href={r.value}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 rounded-lg gradient-emerald text-[11px] font-black btn-press flex items-center justify-center"
            >
              ওপেন
            </a>
          </div>
        </div>
      ))}

      <button
        onClick={() =>
          copy(
            `📱 Good-App\n\nওয়েবসাইট: ${SITE_URL}\nঅ্যাপ ডাউনলোড: ${DOWNLOAD_URL}`,
            "দুইটি লিংক একসাথে",
          )
        }
        className="w-full py-2.5 rounded-xl gradient-cyan text-xs font-black btn-press"
      >
        দুইটি লিংক একসাথে কপি করুন
      </button>
    </div>
  );
}
