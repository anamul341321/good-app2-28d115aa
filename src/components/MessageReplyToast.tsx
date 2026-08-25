import { useState } from "react";
import { toast } from "sonner";
import { Send, X, MessageCircle } from "lucide-react";
import { sendMessage } from "@/lib/chat.functions";

/**
 * Messenger-স্টাইল উপরের নোটিফিকেশন — কে মেসেজ দিয়েছে দেখায়,
 * আর ওখান থেকেই সরাসরি রিপ্লাই দেওয়া যায়।
 */
export function MessageReplyToast({
  toastId,
  peerId,
  name,
  avatarUrl,
  body,
  onOpen,
  onSent,
}: {
  toastId: string | number;
  peerId: string;
  name: string;
  avatarUrl?: string | null;
  body: string;
  onOpen: () => void;
  onSent?: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await sendMessage({ data: { peerId, body: value, kind: "text" } });
      setText("");
      onSent?.();
      toast.dismiss(toastId);
      toast.success("রিপ্লাই পাঠানো হয়েছে");
    } catch {
      toast.error("রিপ্লাই পাঠানো যায়নি");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-[min(92vw,420px)] rounded-2xl border border-border bg-surface p-3 shadow-2xl">
      <div className="flex items-start gap-3">
        <button onClick={onOpen} className="shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/20 text-primary">
              <MessageCircle className="h-5 w-5" />
            </span>
          )}
        </button>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-black">{name}</p>
          <p className="line-clamp-2 text-xs font-semibold text-muted-foreground">{body || "নতুন মেসেজ"}</p>
        </button>
        <button
          aria-label="বন্ধ"
          onClick={() => toast.dismiss(toastId)}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="এখান থেকেই রিপ্লাই দিন…"
          className="h-9 flex-1 rounded-full border border-border bg-background px-3 text-xs font-semibold outline-none focus:border-primary"
        />
        <button
          aria-label="পাঠান"
          disabled={sending || !text.trim()}
          onClick={() => void send()}
          className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
