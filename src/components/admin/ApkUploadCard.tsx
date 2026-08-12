import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, Loader2, Smartphone, Copy } from "lucide-react";
import { toast } from "sonner";
import { adminCreateApkUpload, adminSetApkRelease } from "@/lib/admin.functions";

/**
 * অ্যাডমিন প্যানেল থেকে APK আপলোড — ফাইলটা সরাসরি ব্রাউজার থেকে
 * storage-এ যায় (signed upload URL), তাই বড় ফাইলেও সমস্যা হয় না।
 * আপলোড শেষ হলে সব ইউজারের হোম স্ক্রিনে ডাউনলোড কার্ড দেখাবে।
 */
export function ApkUploadCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState("1.0");
  const [progress, setProgress] = useState<number | null>(null);
  const [doneUrl, setDoneUrl] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { path, signedUrl } = await adminCreateApkUpload({ data: { version } });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("content-type", "application/vnd.android.package-archive");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`আপলোড ব্যর্থ (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন"));
        xhr.send(file);
      });
      return adminSetApkRelease({ data: { path, version } });
    },
    onSuccess: (res) => {
      setProgress(null);
      setDoneUrl(res.downloadUrl);
      toast.success("✅ APK আপলোড হয়েছে — এখন সব ইউজার ডাউনলোড করতে পারবে");
    },
    onError: (e: any) => {
      setProgress(null);
      toast.error(e.message);
    },
  });

  const fullUrl =
    typeof window !== "undefined" && doneUrl ? `${window.location.origin}${doneUrl}` : null;

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-emerald-500" />
        <p className="font-black text-sm">অ্যাপ (APK) আপলোড</p>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        GitHub Actions থেকে বানানো <b>app-release.apk</b> ফাইলটা এখানে আপলোড করুন। আপলোড হলেই
        ইউজারদের হোম স্ক্রিনে "অ্যাপ ডাউনলোড করুন" কার্ড দেখাবে।
      </p>

      <div className="flex items-center gap-2">
        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="ভার্সন (যেমন 1.2)"
          className="w-28 rounded-xl bg-background border border-border px-3 py-2 text-xs font-bold"
        />
        <input
          ref={inputRef}
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="flex-1 py-2.5 rounded-xl gradient-emerald text-xs font-black btn-press flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {upload.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {upload.isPending ? `আপলোড হচ্ছে… ${progress ?? 0}%` : "APK ফাইল বেছে নিন"}
        </button>
      </div>

      {progress !== null && (
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div className="h-full gradient-emerald transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {fullUrl && (
        <button
          onClick={() => {
            navigator.clipboard?.writeText(fullUrl);
            toast.success("লিংক কপি হয়েছে");
          }}
          className="w-full text-[11px] font-bold text-cyan flex items-center justify-center gap-1.5 btn-press"
        >
          <Copy className="w-3.5 h-3.5" /> {fullUrl}
        </button>
      )}
    </div>
  );
}
