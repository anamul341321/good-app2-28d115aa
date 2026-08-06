import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, Loader2, Scan, AlertTriangle, ImagePlus } from "lucide-react";
import type { NarrationKey } from "@/lib/narrations";
import { playVoiceAuto } from "@/lib/voice-guide";
import { FaceConsentModal } from "./FaceConsentModal";

type FaceCaptureProps = {
  onCapture: (photoBase64: string) => void;
  onCancel: () => void;
  isUploading?: boolean;
  title?: string;
  submitLabel?: string;
  readyVoice?: NarrationKey;
  retryVoice?: NarrationKey;
  cancelVoice?: NarrationKey;
  /** If true, skip the explicit consent modal (e.g. re-verification). */
  skipConsent?: boolean;
};

type Mode = "consent" | "choice" | "camera" | "review";

const CONSENT_KEY = "good-app-face-consent";

export function FaceCapture({
  onCapture,
  onCancel,
  isUploading,
  title,
  submitLabel = "জমা দিন",
  readyVoice = "task.photo.submit",
  retryVoice = "task.photo.retry",
  cancelVoice = "common.cancel",
  skipConsent = false,
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialMode: Mode =
    skipConsent || (typeof window !== "undefined" && localStorage.getItem(CONSENT_KEY) === "1")
      ? "choice"
      : "consent";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const [faceWarning, setFaceWarning] = useState<string | null>(null);

  const acceptConsent = useCallback(() => {
    try { localStorage.setItem(CONSENT_KEY, "1"); } catch {}
    setMode("choice");
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (detectionRef.current) clearInterval(detectionRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    setCameraReady(false);
    setAutoCountdown(null);
    setFaceWarning(null);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setMode("camera");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("এই ব্রাউজারে ক্যামেরা সাপোর্ট নেই — গ্যালারি ব্যবহার করুন");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      // wait a tick so the video element is mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
      }, 30);
    } catch (err: any) {
      const name = err?.name || "";
      const msg =
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "ক্যামেরা অনুমতি দেওয়া হয়নি — ব্রাউজার সেটিংস থেকে অনুমতি দিন, বা গ্যালারি ব্যবহার করুন"
          : name === "NotFoundError" || name === "DevicesNotFoundError"
          ? "ক্যামেরা পাওয়া যায়নি — গ্যালারি থেকে ছবি আপলোড করুন"
          : "ক্যামেরা চালু হয়নি — গ্যালারি ব্যবহার করুন";
      setCameraError(msg);
    }
  }, []);

  const onPickFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    stopCamera();
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl.startsWith("data:image")) return;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current ?? document.createElement("canvas");
        const max = 1280;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setCapturedImage(canvas.toDataURL("image/jpeg", 0.85));
        setMode("review");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [stopCamera]);

  const captureNow = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    setMode("review");
    stopCamera();
  }, [stopCamera]);

  // Simple skin-tone detection auto-capture
  useEffect(() => {
    if (mode !== "camera" || !cameraReady) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    detectionRef.current = setInterval(() => {
      if (!video.videoWidth) return;
      canvas.width = 80;
      canvas.height = 60;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, 80, 60);
      const { data } = ctx.getImageData(0, 0, 80, 60);
      let skin = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 80 && g > 40 && b > 25 && r > g && r > b && Math.abs(r - g) > 10) skin++;
      }
      const ratio = skin / (80 * 60);
      if (ratio > 0.08) {
        setFaceWarning(null);
        if (autoCountdown === null) {
          let n = 3;
          setAutoCountdown(n);
          const tick = () => {
            n -= 1;
            if (n <= 0) {
              setAutoCountdown(null);
              captureNow();
            } else {
              setAutoCountdown(n);
              countdownTimerRef.current = setTimeout(tick, 800);
            }
          };
          countdownTimerRef.current = setTimeout(tick, 800);
        }
      } else {
        setFaceWarning("মুখ ফ্রেমে আনুন");
        setAutoCountdown(null);
        if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      }
    }, 600);

    return () => {
      if (detectionRef.current) clearInterval(detectionRef.current);
    };
  }, [mode, cameraReady, autoCountdown, captureNow]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (mode === "review") playVoiceAuto(readyVoice);
  }, [mode, readyVoice]);

  const submit = () => {
    if (!capturedImage) return;
    const base64 = capturedImage.split(",")[1];
    onCapture(base64);
  };

  const backToChoice = () => {
    stopCamera();
    setCapturedImage(null);
    setCameraError(null);
    setMode("choice");
  };

  return (
    <div className="space-y-3">
      {mode === "consent" && (
        <FaceConsentModal onAgree={acceptConsent} onDecline={onCancel} />
      )}

      {title && <p className="text-xs font-bold text-cyan text-center">{title}</p>}

      {mode === "choice" && (
        <div className="space-y-2">
          <p className="text-center text-[11px] text-muted-foreground">
            কিভাবে ছবি দিবেন সেটা বেছে নিন
          </p>
          <button
            type="button"
            onClick={startCamera}
            className="w-full py-4 rounded-2xl gradient-cta text-white font-black flex items-center justify-center gap-2 shadow-lg btn-press"
          >
            <Camera className="w-5 h-5" /> ক্যামেরা দিয়ে তুলুন
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-violet/60 bg-violet/10 text-violet font-black flex items-center justify-center gap-2 btn-press"
          >
            <ImagePlus className="w-5 h-5" /> গ্যালারি থেকে আপলোড করুন
          </button>
          <p className="text-[10px] text-muted-foreground text-center leading-snug">
            ক্যামেরায় অনুমতি না দিলে গ্যালারি থেকেই দিন — একই কাজ হবে
          </p>
        </div>
      )}

      {mode === "camera" && (
        <div className="space-y-2">
          {cameraError ? (
            <div className="rounded-xl bg-rose/10 border border-rose/40 p-4 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-rose mx-auto" />
              <p className="text-xs text-rose leading-snug">{cameraError}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-violet text-white text-xs font-black flex items-center justify-center gap-2"
              >
                <ImagePlus className="w-4 h-4" /> গ্যালারি থেকে আপলোড করুন
              </button>
              <button
                type="button"
                onClick={backToChoice}
                className="w-full py-2 rounded-xl border border-border text-[11px] text-muted-foreground"
              >
                পিছনে যান
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <video ref={videoRef} autoPlay playsInline muted
                  className="w-full rounded-xl border border-cyan/30 bg-black" />
                {autoCountdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center text-6xl font-black text-cyan bg-black/40 rounded-xl">
                    {autoCountdown}
                  </div>
                )}
                {faceWarning && (
                  <p className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-amber/90 text-black text-[10px] font-bold px-2 py-1 rounded">
                    {faceWarning}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={backToChoice}
                className="w-full py-2 rounded-xl border border-border text-[11px] text-muted-foreground"
              >
                পিছনে যান / গ্যালারি ব্যবহার করুন
              </button>
            </>
          )}
        </div>
      )}

      {mode === "review" && capturedImage && (
        <div className="space-y-2">
          <img src={capturedImage} alt="" className="w-full rounded-xl border border-cyan/30" />
          <div className="flex gap-2">
            <button onClick={backToChoice}
              disabled={isUploading}
              data-voice={retryVoice}
              className="flex-1 py-2 rounded-xl bg-surface-2 text-xs font-bold">Retry</button>
            <button onClick={submit} disabled={isUploading}
              data-voice={readyVoice}
              className="flex-1 py-2 rounded-xl gradient-cta text-xs font-black flex items-center justify-center gap-1">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
              {submitLabel}
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = "";
        }}
      />
      <canvas ref={canvasRef} className="hidden" />

      <button onClick={onCancel} data-voice={cancelVoice}
        className="w-full py-2 rounded-xl border border-border text-xs text-muted-foreground flex items-center justify-center gap-1">
        <X className="w-3 h-3" /> বাতিল
      </button>
    </div>
  );
}
