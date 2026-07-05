import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, Loader2, Scan, AlertTriangle, ImagePlus } from "lucide-react";
import type { NarrationKey } from "@/lib/narrations";
import { playVoiceAuto } from "@/lib/voice-guide";

type FaceCaptureProps = {
  onCapture: (photoBase64: string) => void;
  onCancel: () => void;
  isUploading?: boolean;
  title?: string;
  submitLabel?: string;
  readyVoice?: NarrationKey;
  retryVoice?: NarrationKey;
  cancelVoice?: NarrationKey;
};

export function FaceCapture({
  onCapture,
  onCancel,
  isUploading,
  title,
  submitLabel = "জমা দিন",
  readyVoice = "task.photo.submit",
  retryVoice = "task.photo.retry",
  cancelVoice = "common.cancel",
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const [faceWarning, setFaceWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl.startsWith("data:image")) return;
      // Re-encode to JPEG via canvas so the server always receives image/jpeg.
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
        stopCameraRef.current?.();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const stopCameraRef = useRef<(() => void) | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setCameraError("Camera chalu hoini — permission din");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (detectionRef.current) clearInterval(detectionRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
  }, []);
  stopCameraRef.current = stopCamera;

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
    stopCamera();
  }, [stopCamera]);

  // Naive skin-tone-based face presence check (no ML dep)
  useEffect(() => {
    if (!cameraReady || capturedImage) return;
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
        setFaceWarning("Mukh frame e anun");
        setAutoCountdown(null);
        if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      }
    }, 600);

    return () => {
      if (detectionRef.current) clearInterval(detectionRef.current);
    };
  }, [cameraReady, capturedImage, autoCountdown, captureNow]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (capturedImage) playVoiceAuto(readyVoice);
  }, [capturedImage, readyVoice]);

  const submit = () => {
    if (!capturedImage) return;
    const base64 = capturedImage.split(",")[1];
    onCapture(base64);
  };

  return (
    <div className="space-y-3">
      {title && <p className="text-xs font-bold text-cyan text-center">{title}</p>}
      {cameraError ? (
        <div className="rounded-xl bg-rose/10 border border-rose/40 p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-rose mx-auto mb-1" />
          <p className="text-xs text-rose">{cameraError}</p>
        </div>
      ) : capturedImage ? (
        <div className="space-y-2">
          <img src={capturedImage} alt="" className="w-full rounded-xl border border-cyan/30" />
          <div className="flex gap-2">
            <button onClick={() => { setCapturedImage(null); startCamera(); }}
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
      ) : (
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
      )}
      <canvas ref={canvasRef} className="hidden" />
      <button onClick={onCancel} data-voice={cancelVoice}
        className="w-full py-2 rounded-xl border border-border text-xs text-muted-foreground flex items-center justify-center gap-1">
        <X className="w-3 h-3" /> বাতিল
      </button>
      <p className="sr-only"><Camera className="w-3 h-3" /></p>
    </div>
  );
}
