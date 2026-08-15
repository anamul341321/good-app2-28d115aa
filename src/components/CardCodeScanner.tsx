import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminScanCardImage } from "@/lib/card-scan.functions";
import { X, Camera, Loader2, ScanLine, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export function CardCodeScanner({
  onCodes,
  onClose,
}: {
  onCodes: (codes: string[]) => void;
  onClose: () => void;
}) {
  const scan = useServerFn(adminScanCardImage);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setReady(true);
      } catch (e: any) {
        setError(e?.message ?? "ক্যামেরা খোলা গেল না");
      }
    })();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function runScan(dataUrl: string) {
    setBusy(true);
    try {
      const res = await scan({ data: { image: dataUrl } });
      const codes = res.codes ?? [];
      if (codes.length === 0) {
        toast.error("কোড পড়া গেল না — কার্ডটি আলোতে ধরে আবার চেষ্টা করুন");
      } else {
        setFound((prev) => Array.from(new Set([...prev, ...codes])));
        toast.success(`${codes.length}টি কোড পাওয়া গেছে`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "স্ক্যান ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  async function captureFrame() {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    await runScan(canvas.toDataURL("image/jpeg", 0.9));
  }

  async function onPickFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => runScan(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col p-4">
      <div className="flex items-center justify-between text-white">
        <p className="font-black text-sm flex items-center gap-2">
          <ScanLine className="w-4 h-4" /> কার্ড স্ক্যানার
        </p>
        <button onClick={onClose} className="rounded-full bg-white/10 hover:bg-white/20 p-2">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative mt-3 w-full max-w-md mx-auto aspect-[4/3] rounded-3xl overflow-hidden border-2 border-cyan-400/50 bg-black">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 h-24 rounded-2xl border-4 border-emerald-400/80" />
        {(!ready || busy) && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 text-white">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-xs font-bold">{busy ? "কোড পড়া হচ্ছে…" : "ক্যামেরা চালু হচ্ছে…"}</p>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-center text-rose-300 text-xs font-bold">{error}</p>}
      <p className="mt-3 text-center text-white/80 text-[11px] font-bold">
        ঘষা তোলা নম্বরটি সবুজ ফ্রেমের ভিতরে রাখুন, তারপর Scan চাপুন
      </p>

      <div className="mt-3 flex gap-2 max-w-md mx-auto w-full">
        <button
          onClick={captureFrame}
          disabled={!ready || busy}
          className="flex-1 py-3 rounded-2xl bg-cyan-500 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Camera className="w-4 h-4" /> Scan
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="px-4 py-3 rounded-2xl bg-white/10 text-white font-black text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <ImageIcon className="w-4 h-4" /> ছবি
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {found.length > 0 && (
        <div className="mt-4 max-w-md mx-auto w-full bg-white/5 rounded-2xl p-3 space-y-2 overflow-y-auto max-h-48">
          {found.map((c) => (
            <div key={c} className="flex items-center gap-2 text-white text-sm font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">{c}</span>
              <button
                onClick={() => setFound((p) => p.filter((x) => x !== c))}
                className="ml-auto text-white/50 hover:text-rose-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {found.length > 0 && (
        <button
          onClick={() => {
            onCodes(found);
            onClose();
          }}
          className="mt-3 max-w-md mx-auto w-full py-3 rounded-2xl bg-emerald-500 text-white font-black text-sm"
        >
          {found.length}টি কোড স্টকে যোগ করুন
        </button>
      )}
    </div>
  );
}
