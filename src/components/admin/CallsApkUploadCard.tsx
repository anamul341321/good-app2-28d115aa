import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, PhoneCall, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateApkUpload,
  adminGetBonusSettings,
  adminSetApkRelease,
} from "@/lib/admin.functions";

const CALLS_APPLICATION_ID = "com.goodapp.calls";

function normalizeAndroidVersion(value: string): string {
  const match = value.trim().match(/\d+(?:\.\d+){1,2}/);
  return match?.[0] ?? "";
}

/**
 * GoodApp Call (শুধু কলিং অ্যাপ) APK আপলোড — GitHub Actions থেকে নামানো
 * calls বিল্ডের ZIP দিলে ভিতরের APK বের করে আপলোড হয় এবং সাথে সাথে
 * ডাউনলোড লিংক চালু হয়ে যায় (/api/public/app/download?calls=1)।
 */
export function CallsApkUploadCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [version, setVersion] = useState("1.0");
  const [progress, setProgress] = useState<number | null>(null);
  const [doneUrl, setDoneUrl] = useState<string | null>(null);
  const { data: settings } = useQuery({
    queryKey: ["admin-bonus-settings"],
    queryFn: () => adminGetBonusSettings(),
  });
  const activeVersion = (settings as any)?.apk_calls_version as string | null | undefined;

  const upload = useMutation({
    mutationFn: async (picked: File) => {
      if (!/\.zip$/i.test(picked.name) && picked.type !== "application/zip") {
        throw new Error("GitHub Actions থেকে download করা calls বিল্ডের ZIP ফাইলটি দিন");
      }
      setProgress(0);
      const { unzipSync } = await import("fflate");
      const buf = new Uint8Array(await picked.arrayBuffer());
      const files = unzipSync(buf);
      const metadataName = Object.keys(files).find((n) => /release-metadata\.json$/i.test(n));
      let artifactVersion = "";
      if (metadataName) {
        try {
          const metadata = JSON.parse(new TextDecoder().decode(files[metadataName]));
          artifactVersion = normalizeAndroidVersion(String(metadata.versionName ?? ""));
          const appId = String(metadata.applicationId ?? "");
          if (appId && appId !== CALLS_APPLICATION_ID && appId !== "com.anamul.goodapp") {
            throw new Error("এই ZIP কলিং অ্যাপের বিল্ড নয়—Build mode: calls দিয়ে বানানো ZIP দিন");
          }
        } catch (e: any) {
          if (e?.message?.includes("কলিং")) throw e;
        }
      }
      const releaseVersion = artifactVersion || normalizeAndroidVersion(version);
      if (!releaseVersion) throw new Error("সঠিক ভার্সন দিন—যেমন 1.0");
      const apkName = Object.keys(files).find((n) => /\.apk$/i.test(n));
      if (!apkName) throw new Error("ZIP ফাইলের ভিতরে কোনো .apk পাওয়া যায়নি");
      const file = new File(
        [files[apkName] as any],
        apkName.split("/").pop() || "GoodApp-Call.apk",
        { type: "application/vnd.android.package-archive" },
      );
      const { path, signedUrl } = await adminCreateApkUpload({
        data: { version: releaseVersion, calls: true },
      });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("content-type", "application/vnd.android.package-archive");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status < 300 ? resolve() : reject(new Error(`আপলোড ব্যর্থ (${xhr.status})`));
        xhr.onerror = () => reject(new Error("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন"));
        xhr.send(file);
      });
      return adminSetApkRelease({ data: { path, version: releaseVersion, calls: true } });
    },
    onSuccess: (res) => {
      setProgress(null);
      setDoneUrl(res.downloadUrl);
      setVersion(res.version);
      queryClient.setQueryData(["admin-bonus-settings"], (old: any) => ({
        ...(old ?? {}),
        apk_calls_url: res.path,
        apk_calls_version: res.version,
      }));
      toast.success(`✅ GoodApp Call v${res.version} চালু হয়েছে — ডাউনলোড লিংক তৈরি`);
    },
    onError: (e: any) => {
      setProgress(null);
      toast.error(e.message);
    },
  });

  const liveUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/app/download?calls=1`
      : null;
  const fullUrl =
    typeof window !== "undefined" && doneUrl ? `${window.location.origin}${doneUrl}` : liveUrl;

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PhoneCall className="w-4 h-4 text-violet-500" />
        <p className="font-black text-sm">GoodApp Call (কলিং অ্যাপ) APK আপলোড</p>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        GitHub Actions-এ <b>Build mode: calls</b> দিয়ে বানানো ZIP এখানে দিন — আপলোড হলেই কলিং
        অ্যাপের ডাউনলোড লিংক চালু হয়ে যাবে। ইউজাররা ওয়েবসাইটের ডাউনলোড পেজ ও টেলিগ্রাম বট থেকে
        এই লিংক পাবে।
      </p>

      <div className="flex items-center justify-between rounded-xl border border-violet-500/30 bg-background px-3 py-2 text-xs">
        <span className="text-muted-foreground">কলিং অ্যাপ চালু</span>
        <strong className="text-violet-600">v{activeVersion || "—"}</strong>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="ভার্সন (যেমন 1.0)"
          className="w-28 rounded-xl bg-background border border-border px-3 py-2 text-xs font-bold"
        />
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
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
          className="flex-1 py-2.5 rounded-xl text-xs font-black btn-press flex items-center justify-center gap-2 disabled:opacity-60 gradient-cyan"
        >
          {upload.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {upload.isPending
            ? `আপলোড হচ্ছে… ${progress ?? 0}%`
            : "কলিং অ্যাপের release ZIP বেছে নিন"}
        </button>
      </div>

      {progress !== null && (
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div className="h-full gradient-cyan transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {activeVersion && fullUrl && (
        <button
          onClick={() => {
            navigator.clipboard?.writeText(fullUrl);
            toast.success("কলিং অ্যাপের ডাউনলোড লিংক কপি হয়েছে");
          }}
          className="w-full text-[11px] font-bold text-cyan flex items-center justify-center gap-1.5 btn-press break-all"
        >
          <Copy className="w-3.5 h-3.5 shrink-0" /> {fullUrl}
        </button>
      )}
    </div>
  );
}
