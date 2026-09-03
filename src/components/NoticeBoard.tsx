import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, ChevronDown, X } from "lucide-react";
import { listActiveAnnouncements } from "@/lib/announcements.functions";

const SEEN_KEY = "good-app-notice-seen";

/**
 * নোটিশ বোর্ড — আগের TV-স্টাইল স্ক্রলিং টিকারের বদলে সহজে পড়া যায় এমন কার্ড।
 * একাধিক নোটিশ থাকলে সবগুলো তালিকায় দেখা যায়, লম্বা লেখা "আরও পড়ুন" দিয়ে খোলে,
 * এবং পড়ে ফেললে ইউজার নোটিশটি বন্ধ করে রাখতে পারে (নতুন নোটিশ এলে আবার দেখাবে)।
 */
export function NoticeBoard() {
  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => listActiveAnnouncements(),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const items = useMemo(() => (data ?? []) as any[], [data]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (raw) setDismissed(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = (id: string) => {
    const next = [...new Set([...dismissed, id])].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const visible = items.filter((a) => !dismissed.includes(String(a.id)));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {visible.map((a) => {
        const id = String(a.id);
        const text = String(a.message ?? "").trim();
        const long = text.length > 150;
        const open = !!expanded[id];
        return (
          <article
            key={id}
            className="relative overflow-hidden rounded-3xl border border-amber-400/35 bg-surface shadow-[0_16px_40px_-22px_rgba(245,158,11,0.55)]"
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ background: "linear-gradient(120deg,#f59e0b,#ec4899)" }}
            >
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-white/25 backdrop-blur">
                <Megaphone className="h-3.5 w-3.5 text-white" />
              </span>
              <p className="flex-1 text-[11px] font-black uppercase tracking-[0.2em] text-white">
                নোটিশ
              </p>
              {a.created_at && (
                <span className="text-[10px] font-bold text-white/85">
                  {new Date(a.created_at).toLocaleDateString("bn-BD", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              )}
              <button
                onClick={() => dismiss(id)}
                aria-label="নোটিশ বন্ধ করুন"
                className="grid h-6 w-6 place-items-center rounded-lg bg-black/20 text-white/90 btn-press"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="px-4 py-3.5">
              <p
                className={`text-[13.5px] font-bold leading-[1.85] text-navy whitespace-pre-line ${
                  long && !open ? "line-clamp-4" : ""
                }`}
              >
                {text}
              </p>
              {long && (
                <button
                  onClick={() => setExpanded((s) => ({ ...s, [id]: !open }))}
                  className="mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1 text-[11px] font-black text-cyan btn-press"
                >
                  {open ? "কম দেখুন" : "আরও পড়ুন"}
                  <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
