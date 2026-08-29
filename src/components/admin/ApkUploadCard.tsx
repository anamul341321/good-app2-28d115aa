import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, Smartphone, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateApkUpload,
  adminGetBonusSettings,
  adminSetApkRelease,
} from "@/lib/admin.functions";

const CURRENT_ANDROID_VERSION = "1.31";

function normalizeAndroidVersion(value: string): string {
  const match = value.trim().match(/\d+(?:\.\d+){1,2}/);
  return match?.[0] ?? "";
}

/**
 * অ্যাডমিন প্যানেল থেকে APK আপলোড — ফাইলটা সরাসরি ব্রাউজার থেকে
 * storage-এ যায় (signed upload URL), তাই বড় ফাইলেও সমস্যা হয় না।
 * আপলোড শেষ হলে সব ইউজারের হোম স্ক্রিনে ডাউনলোড কার্ড দেখাবে।
 */
export function ApkUploadCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [version, setVersion] = useState(CURRENT_ANDROID_VERSION);
  const [progress, setProgress] = useState<number | null>(null);
  const [doneUrl, setDoneUrl] = useState<string | null>(null);
  const { data: settings } = useQuery({
    queryKey: ["admin-bonus-settings"],
    queryFn: () => adminGetBonusSettings(),
  });
  const activeVersion = (settings as any)?.apk_version as string | null | undefined;

  useEffect(() => {
    // আপলোড বক্সে সবসময় সোর্স কোডের সর্বশেষ ভার্সনই দেখাবে, তাই আগের
    // চালু ভার্সন সমান/পুরোনো হলে সেটির বদলে নতুনটাই বসে।
    const num = (v: string) => (v.match(/\d+/g) ?? []).map(Number);
    const older = (a: string, b: string) => {
      const x = num(a),
        y = num(b);
      for (let i = 0; i < Math.max(x.length, y.length); i++) {
        if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
      }
      return true; // equal → treat as older so we suggest the new build
    };
    if (!activeVersion || older(activeVersion, CURRENT_ANDROID_VERSION)) {
      setVersion(CURRENT_ANDROID_VERSION);
    } else setVersion(activeVersion);
  }, [activeVersion]);

  const upload = useMutation({
    mutationFn: async (picked: File) => {
      const releaseVersion = normalizeAndroidVersion(version);
      if (!releaseVersion) throw new Error("সঠিক ভার্সন দিন—যেমন 1.5");
      if (!/\.zip$/i.test(picked.name) && picked.type !== "application/zip") {
        throw new Error("GitHub Actions থেকে download করা নতুন release-apk.zip ফাইলটি দিন");
      }
      setProgress(0);
      const { unzipSync } = await import("fflate");
      const buf = new Uint8Array(await picked.arrayBuffer());
      const files = unzipSync(buf);
      const metadataName = Object.keys(files).find((n) => /release-metadata\.json$/i.test(n));
      if (!metadataName) {
        throw new Error("এটি পুরোনো/ভুল artifact—নতুন GitHub workflow থেকে ZIP download করুন");
      }
      const metadata = JSON.parse(new TextDecoder().decode(files[metadataName]));
      const artifactVersion = normalizeAndroidVersion(String(metadata.versionName ?? ""));
      if (!artifactVersion) throw new Error("ZIP-এর Android version পাওয়া যায়নি");
      if (artifactVersion !== releaseVersion) {
        throw new Error(
          `এই ZIP v${artifactVersion}, কিন্তু ঘরে v${releaseVersion} লেখা—সঠিক নতুন file দিন`,
        );
      }
      const apkName = Object.keys(files).find((n) => /\.apk$/i.test(n));
      if (!apkName) throw new Error("zip ফাইলের ভিতরে কোনো .apk পাওয়া যায়নি");
      const file = new File(
        [files[apkName] as any],
        apkName.split("/").pop() || "app-release.apk",
        {
          type: "application/vnd.android.package-archive",
        },
      );
      const { path, signedUrl } = await adminCreateApkUpload({ data: { version: releaseVersion } });
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
      return adminSetApkRelease({ data: { path, version: releaseVersion } });
    },
    onSuccess: (res) => {
      setProgress(null);
      setDoneUrl(res.downloadUrl);
      setVersion(res.version);
      queryClient.setQueryData(["admin-bonus-settings"], (old: any) => ({
        ...(old ?? {}),
        apk_url: res.path,
        apk_version: res.version,
      }));
      queryClient.invalidateQueries({ queryKey: ["app-status-apk"] });
      toast.success(`✅ Good-App v${res.version} চালু হয়েছে — ইউজাররা এখন নতুন APK পাবে`);
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
        GitHub Actions থেকে নতুন করে নামানো <b>release-apk.zip</b> সোজা এখানে দিন — ভিতরের version
        যাচাই করে <b>APK</b> নিজে থেকেই বের করে আপলোড হবে। পুরোনো বা ভুল ZIP গ্রহণ করবে না। আপলোড
        হলেই ইউজারদের হোম স্ক্রিনে "অ্যাপ ডাউনলোড করুন" কার্ড দেখাবে।
      </p>

      <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-background px-3 py-2 text-xs">
        <span className="text-muted-foreground">বর্তমানে চালু</span>
        <strong className="text-emerald-600">v{activeVersion || "—"}</strong>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="ভার্সন (যেমন 1.7)"
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
          className="flex-1 py-2.5 rounded-xl gradient-emerald text-xs font-black btn-press flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {upload.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {upload.isPending
            ? `v${version} আপলোড হচ্ছে… ${progress ?? 0}%`
            : `v${version} release ZIP বেছে নিন`}
        </button>
      </div>

      {progress !== null && (
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full gradient-emerald transition-all"
            style={{ width: `${progress}%` }}
          />
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
