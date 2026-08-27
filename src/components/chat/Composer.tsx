import { useRef, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Mic, Send, Square, Video, Plus, Smile, X, Reply } from "lucide-react";
import { extOf, uploadChatFile, type UploadKind } from "@/lib/chat-upload";

export type SendPayload = {
  body?: string;
  kind?: "text" | "image" | "video" | "voice";
  mediaPath?: string;
  mediaMeta?: Record<string, any>;
};

/** Messenger-style input bar */
export function Composer({
  onSend,
  sending,
  replyTo,
  onCancelReply,
}: {
  onSend: (p: SendPayload) => void;
  sending: boolean;
  /** মেসেঞ্জারের মতো — যে মেসেজটির রিপ্লাই দেওয়া হচ্ছে */
  replyTo?: { id: string; body?: string; kind?: string; name?: string } | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const vidRef = useRef<HTMLInputElement | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const elapsed = useRef(0);

  const replyMeta = () =>
    replyTo
      ? { replyTo: { id: replyTo.id, body: replyTo.body ?? "", kind: replyTo.kind ?? "text", name: replyTo.name ?? "" } }
      : undefined;

  const submitText = () => {
    const b = text.trim();
    if (!b) return;
    setText("");
    const meta = replyMeta();
    onCancelReply?.();
    onSend({ body: b, kind: "text", ...(meta ? { mediaMeta: meta } : {}) });
  };

  const pick = async (file: File | undefined, kind: UploadKind) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadChatFile(file, kind, extOf(file.name, kind === "image" ? "jpg" : "mp4"));
      onSend({ kind, mediaPath: path, mediaMeta: { name: file.name, size: file.size, ...replyMeta() } });
      onCancelReply?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(timer.current);
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        const duration = elapsed.current;
        elapsed.current = 0;
        setRecSec(0);
        if (blob.size < 800) return;
        setBusy(true);
        try {
          const path = await uploadChatFile(blob, "voice", "webm");
          onSend({ kind: "voice", mediaPath: path, mediaMeta: { size: blob.size, duration, ...replyMeta() } });
          onCancelReply?.();
        } catch (e: any) {
          toast.error(e?.message ?? "Failed to send voice");
        } finally {
          setBusy(false);
        }
      };
      mr.start();
      rec.current = mr;
      elapsed.current = 1;
      setRecSec(1);
      timer.current = window.setInterval(() =>
        setRecSec((v) => {
          elapsed.current = v + 1;
          return v + 1;
        }), 1000);
    } catch {
      toast.error("Allow microphone access");
    }
  };

  const stopRec = () => {
    rec.current?.stop();
    rec.current = null;
  };

  const recording = recSec > 0;

  return (
    <div className="bg-background px-2 py-2 border-t">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-2xl border-l-4 border-primary bg-surface-2 px-3 py-2">
          <Reply className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-black text-primary">
              {replyTo.name ? `${replyTo.name}-কে রিপ্লাই` : "রিপ্লাই দিচ্ছেন"}
            </p>
            <p className="truncate text-[11px] font-bold text-muted-foreground">
              {replyTo.body?.trim()
                ? replyTo.body
                : replyTo.kind === "image"
                  ? "📷 ছবি"
                  : replyTo.kind === "video"
                    ? "🎬 ভিডিও"
                    : replyTo.kind === "voice"
                      ? "🎤 ভয়েস"
                      : "মেসেজ"}
            </p>
          </div>
          <button onClick={onCancelReply} aria-label="বাতিল" className="btn-press shrink-0 rounded-full p-1 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <input
        ref={imgRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void pick(e.target.files?.[0], "image")}
      />
      <input
        ref={vidRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => void pick(e.target.files?.[0], "video")}
      />

      {recording ? (
        <div className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-full">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
          <div className="flex h-6 flex-1 items-center gap-0.5" aria-label="Recording">
            {Array.from({ length: 24 }, (_, index) => (
              <span
                key={index}
                className="w-0.5 animate-pulse rounded-full bg-rose-500"
                style={{ height: `${6 + ((index * 9) % 18)}px`, animationDelay: `${index * 50}ms` }}
              />
            ))}
          </div>
          <p className="text-[10px] font-black text-rose-500">
            {String(Math.floor(recSec / 60)).padStart(2, "0")}:{String(recSec % 60).padStart(2, "0")}
          </p>
          <button
            onClick={stopRec}
            className="btn-press grid h-8 w-8 place-items-center rounded-full bg-rose-500 text-white"
          >
            <Square className="h-4 w-4 fill-white" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {!text.trim() && (
            <div className="flex items-center gap-2">
              <button
                className="btn-press h-9 w-9 flex items-center justify-center rounded-full text-primary"
                aria-label="More options"
              >
                <Plus className="h-6 w-6" />
              </button>
              <button
                onClick={() => vidRef.current?.click()}
                className="btn-press h-9 w-9 flex items-center justify-center rounded-full text-primary"
                aria-label="Send video"
              >
                <Video className="h-6 w-6" />
              </button>
              <button
                onClick={() => imgRef.current?.click()}
                className="btn-press h-9 w-9 flex items-center justify-center rounded-full text-primary"
                aria-label="Send image"
              >
                <ImageIcon className="h-6 w-6" />
              </button>
            </div>
          )}
          
          <div className="flex-1 relative flex items-center">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitText()}
              placeholder="Aa"
              className="w-full h-10 rounded-full bg-surface-2 px-4 text-sm font-bold focus:outline-none"
            />
            <button className="absolute right-3 text-primary">
              <Smile className="h-5 w-5" />
            </button>
          </div>

          {text.trim() ? (
            <button
              onClick={submitText}
              disabled={sending || busy}
              className="btn-press h-9 w-9 flex items-center justify-center rounded-full text-primary disabled:opacity-50"
            >
              {sending || busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-6 w-6 fill-primary" />}
            </button>
          ) : (
            <button
              onClick={() => void startRec()}
              disabled={busy}
              className="btn-press h-9 w-9 flex items-center justify-center rounded-full text-primary disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-6 w-6" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
