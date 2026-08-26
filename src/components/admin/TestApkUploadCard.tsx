import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, Smartphone, Copy, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateTestApkUpload,
  adminGetBonusSettings,
  adminSetTestApkRelease,
} from "@/lib/admin.functions";

const CURRENT_ANDROID_VERSION = "1.29";

function normalizeAndroidVersion(value: string): string {
  const match = value.trim().match(/\d+(?:\.\d+){1,2}/);
  return match?.[0] ?? "";
}

/**
 * এডমিন টেস্ট APK আপলোড — এটি শুধুমাত্র টেস্ট লিংকের জন্য।
 * এটি সবার কাছে অটোমেটিক যাবে না, আপনি লিংক কপি করে নিজে টেস্ট করতে পারবেন।
 */
export function TestApkUploadCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [version, setVersion] = useState(CURRENT_ANDROID_VERSION);
  const [progress, setProgress] = useState<number | null>(null);
  const [doneUrl, setDoneUrl] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["admin-bonus-settings"],
    queryFn: () => adminGetBonusSettings(),
  });

  const activeTestVersion = (settings as any)?.test_apk_version as string | null | undefined;

  const upload = useMutation({
    mutationFn: async (picked: File) => {
      const releaseVersion = normalizeAndroidVersion(version);
      if (!releaseVersion) throw new Error("সঠিক ভার্সন দিন—যেমন 1.18");

      setProgress(0);
      const { unzipSync } = await import("fflate");
      const buf = new Uint8Array(await picked.arrayBuffer());
      const files = unzipSync(buf);

      const apkName = Object.keys(files).find((n) => /\.apk$/i.test(n));
      if (!apkName) throw new Error("ZIP ফাইলের ভিতরে কোনো .apk পাওয়া যায়নি");

      const file = new File(
        [files[apkName] as any],
        apkName.split("/").pop() || "app-test-release.apk",
        { type: "application/vnd.android.package-archive" },
      );

      const { path, signedUrl } = await adminCreateTestApkUpload({
        data: { version: releaseVersion },
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
        xhr.onerror = () => reject(new Error("নেটওয়ার্ক সমস্যা"));
        xhr.send(file);
      });

      return adminSetTestApkRelease({ data: { path, version: releaseVersion } });
    },
    onSuccess: (res) => {
      setProgress(null);
      setDoneUrl(res.downloadUrl || null);
      queryClient.invalidateQueries({ queryKey: ["admin-bonus-settings"] });
      toast.success(`✅ টেস্ট APK v${res.version} আপলোড হয়েছে। লিংক কপি করে ব্রাউজারে ওপেন করুন।`);
    },
    onError: (e: any) => {
      setProgress(null);
      toast.error(e.message);
    },
  });

  const fullUrl =
    typeof window !== "undefined" && doneUrl
      ? `${window.location.origin}/api/public/app/download?test=1`
      : null;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-amber-500" />
        <p className="font-black text-sm">টেস্ট APK আপলোড (শুধুমাত্র নিজের জন্য)</p>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        এটি আপলোড করলে সাধারণ ইউজাররা নোটিশ পাবে না। আপনি আপলোড করে নিচের <b>টেস্ট লিংক</b> কপি করে
        আপনার ফোনে ডাউনলোড করে পরীক্ষা করতে পারবেন। সব ঠিক থাকলে তবেই মেইন APK আপলোড করবেন।
      </p>

      <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-background px-3 py-2 text-xs">
        <span className="text-muted-foreground">বর্তমান টেস্ট ভার্সন</span>
        <strong className="text-amber-600">v{activeTestVersion || "—"}</strong>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="ভার্সন"
          className="w-24 rounded-xl bg-background border border-border px-3 py-2 text-xs font-bold"
        />
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
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
          className="flex-1 py-2.5 rounded-xl gradient-amber text-xs font-black btn-press flex items-center justify-center gap-2 text-navy"
        >
          {upload.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {upload.isPending ? `আপলোড হচ্ছে… ${progress}%` : "টেস্ট ZIP আপলোড"}
        </button>
      </div>

      {fullUrl && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-amber-600 uppercase">
            পরীক্ষা করার লিংক (ফোনের ব্রাউজারে ওপেন করুন):
          </p>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(fullUrl);
              toast.success("টেস্ট লিংক কপি হয়েছে");
            }}
            className="w-full text-[11px] font-bold text-cyan bg-surface-2 p-2 rounded-lg flex items-center justify-center gap-1.5 border border-border"
          >
            <Copy className="w-3.5 h-3.5" /> {fullUrl}
          </button>
        </div>
      )}
    </div>
  );
}
