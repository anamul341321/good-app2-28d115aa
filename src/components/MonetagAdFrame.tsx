import { useEffect, useState } from "react";

const ZONE = "275797";
const SRC = "https://quge5.com/88/tag.min.js";

/**
 * Monetag ads সবসময় দেখা যাবে — কিন্তু sandboxed iframe-এর ভিতরে।
 * ফলে অ্যাডের popunder / onclick স্ক্রিপ্ট অ্যাপের বাটন দখল করতে পারে না;
 * ইউজার claim / wallet / coins বাটনে চাপ দিলে আর অ্যাডে চলে যায় না।
 */
export function MonetagAdFrame({
  height = 100,
  className = "",
  label = true,
}: {
  height?: number;
  className?: string;
  label?: boolean;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    // নেটিভ অ্যাপে Unity Ads চলে, তাই সেখানে এই ওয়েব ট্যাগ লোড হয় না।
    if (cap?.isNativePlatform?.()) return;
    setReady(true);
  }, []);

  if (!ready) return null;

  const doc = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:system-ui,sans-serif}</style>
</head><body>
<script src="${SRC}" data-zone="${ZONE}" async data-cfasync="false"><\/script>
</body></html>`;

  return (
    <div data-app-ui className={`w-full ${className}`}>
      {label && (
        <div className="px-1 pb-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
          Ad
        </div>
      )}
      <iframe
        title="advertisement"
        srcDoc={doc}
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
        style={{ width: "100%", height, border: 0, display: "block", overflow: "hidden" }}
        scrolling="no"
        className="rounded-xl bg-surface-2/40"
      />
    </div>
  );
}
