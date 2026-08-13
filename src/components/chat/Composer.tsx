import { useRef, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Mic, Send, Square, Video } from "lucide-react";
import { extOf, uploadChatFile, type UploadKind } from "@/lib/chat-upload";

export type SendPayload = {
  body?: string;
  kind?: "text" | "image" | "video" | "voice";
  mediaPath?: string;
  mediaMeta?: Record<string, any>;
};

/** মেসেঞ্জারের মতো ইনপুট বার — টেক্সট, ছবি, ভিডিও ও ভয়েস মেসেজ */
export function Composer({
  onSend,
  sending,
}: {
  onSend: (p: SendPayload) => void;
  sending: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const vidRef = useRef<HTMLInputElement | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);

  const submitText = () => {
    const b = text.trim();
    if (!b) return;
    setText("");
    onSend({ body: b, kind: "text" });
  };

  const pick = async (file: File | undefined, kind: UploadKind) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadChatFile(file, kind, extOf(file.name, kind === "image" ? "jpg" : "mp4"));
      onSend({ kind, mediaPath: path, mediaMeta: { name: file.name, size: file.size } });
    } catch (e: any) {
      toast.error(e?.message ?? "আপলোড হয়নি");
    } finally {
      setBusy(false);
    }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(timer.current);
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        setRecSec(0);
        if (blob.size < 800) return;
        setBusy(true);
        try {
          const path = await uploadChatFile(blob, "voice", "webm");
          onSend({ kind: "voice", mediaPath: path, mediaMeta: { size: blob.size } });
        } catch (e: any) {
          toast.error(e?.message ?? "ভয়েস পাঠানো যায়নি");
        } finally {
          setBusy(false);
        }
      };
      mr.start();
      rec.current = mr;
      setRecSec(1);
      timer.current = window.setInterval(() => setRecSec((v) => v + 1), 1000);
    } catch {
      toast.error("মাইকের অনুমতি দিন");
    }
  };

  const stopRec = () => {
    rec.current?.stop();
    rec.current = null;
  };

  const recording = recSec > 0;

  return (
    <div className="glass sticky bottom-20 mt-3 rounded-2xl p-2">
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
        <div className="flex items-center gap-3 px-2 py-1.5">
          <span className="h-3 w-3 animate-pulse rounded-full bg-rose-500" />
          <p className="flex-1 text-sm font-black text-rose-500">
            ভয়েস রেকর্ড হচ্ছে… {String(Math.floor(recSec / 60)).padStart(2, "0")}:
            {String(recSec % 60).padStart(2, "0")}
          </p>
          <button
            onClick={stopRec}
            className="btn-press grid h-11 w-11 place-items-center rounded-xl bg-rose-500 text-white"
            aria-label="রেকর্ড শেষ করে পাঠান"
          >
            <Square className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => imgRef.current?.click()}
            className="btn-press grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-500"
            aria-label="ছবি পাঠান"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => vidRef.current?.click()}
            className="btn-press grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-500"
            aria-label="ভিডিও পাঠান"
          >
            <Video className="h-5 w-5" />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitText()}
            placeholder="মেসেজ লিখুন…"
            className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-3 text-sm font-bold outline-none"
          />
          {text.trim() ? (
            <button
              onClick={submitText}
              disabled={sending || busy}
              className="gradient-cta btn-press grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white disabled:opacity-50"
              aria-label="পাঠান"
            >
              {sending || busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          ) : (
            <button
              onClick={() => void startRec()}
              disabled={busy}
              className="btn-press grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500 disabled:opacity-50"
              aria-label="ভয়েস মেসেজ"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
