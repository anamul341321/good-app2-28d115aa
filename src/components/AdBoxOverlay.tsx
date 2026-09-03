import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { MonetagAdFrame } from "@/components/MonetagAdFrame";

/**
 * বড় box আকারে ads (Vignette-এর মতো) — নির্দিষ্ট সময় পরপর নিজে থেকে আসে,
 * ইউজার ক্রস দিয়ে বন্ধ করতে পারে। পুরো অ্যাড sandboxed iframe-এর ভিতরে চলে,
 * তাই অ্যাপের কোনো বাটন কখনো hijack হয় না।
 */
export function AdBoxOverlay({
  firstDelayMs = 12_000,
  repeatMs = 150_000,
}: {
  firstDelayMs?: number;
  repeatMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) return; // নেটিভ অ্যাপে Unity ads চলে
    let timer = window.setTimeout(() => setOpen(true), firstDelayMs);
    const loop = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setRound((r) => r + 1);
        setOpen(true);
      }
    }, repeatMs);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(loop);
    };
  }, [firstDelayMs, repeatMs]);

  if (!open) return null;

  return (
    <div data-app-ui className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-3 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Advertisement
          </span>
          <button
            type="button"
            aria-label="close ad"
            onClick={() => setOpen(false)}
            className="rounded-full border border-border bg-surface-2 p-1.5 text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <MonetagAdFrame key={round} height={250} label={false} rotateMs={0} />
      </div>
    </div>
  );
}
