import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, X } from "lucide-react";
import { getMyNotices, markNoticeRead } from "@/lib/notices.functions";

/** Admin থেকে পাঠানো ব্যক্তিগত মেসেজ — লাল হয়ে ভেসে থাকবে, ইউজার না বন্ধ করা পর্যন্ত। */
export function UserNoticeBanner() {
  const qc = useQueryClient();
  const list = useServerFn(getMyNotices);
  const markRead = useServerFn(markNoticeRead);

  const { data } = useQuery({
    queryKey: ["my-notices"],
    queryFn: () => list(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const notices = data ?? [];
  if (notices.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[70] px-3 pt-3 space-y-2 pointer-events-none">
      {notices.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto max-w-md mx-auto rounded-2xl border-2 border-rose/60 bg-rose/95 text-white shadow-2xl p-3.5 animate-in slide-in-from-top duration-500"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black leading-snug">
                {n.title || "📢 অ্যাডমিনের গুরুত্বপূর্ণ মেসেজ"}
              </p>
              <p className="text-[12px] font-bold leading-relaxed mt-1 whitespace-pre-wrap break-words">
                {n.body}
              </p>
            </div>
            <button
              aria-label="বন্ধ করুন"
              onClick={async () => {
                await markRead({ data: { id: n.id } });
                qc.invalidateQueries({ queryKey: ["my-notices"] });
              }}
              className="shrink-0 p-1.5 rounded-lg bg-white/20 btn-press"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
