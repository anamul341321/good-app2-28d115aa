import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, X, CheckCheck } from "lucide-react";
import { getMyNotifications, markAllNoticesRead } from "@/lib/notices.functions";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "এখনই";
  if (m < 60) return `${m} মিনিট আগে`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ঘণ্টা আগে`;
  return `${Math.floor(h / 24)} দিন আগে`;
}

/** হেডারের ঘণ্টা আইকন — সব নোটিফিকেশন এক জায়গায় */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => getMyNotifications(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const readAll = useMutation({
    mutationFn: () => markAllNoticesRead(),
    onSuccess: () => refetch(),
  });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  return (
    <>
      <button
        aria-label="নোটিফিকেশন"
        onClick={() => setOpen(true)}
        className="btn-press relative rounded-xl gradient-navy px-2.5 py-2 text-gold border border-gold/40 shadow-lg"
      >
        <Bell className={`w-5 h-5 ${unread > 0 ? "animate-bounce" : ""}`} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black grid place-items-center border border-white/60">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-14 px-3"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden animate-in slide-in-from-top-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Bell className="w-4 h-4 text-gold" />
              <p className="font-black text-sm flex-1">নোটিফিকেশন</p>
              {unread > 0 && (
                <button
                  onClick={() => readAll.mutate()}
                  className="text-[10px] font-black text-cyan flex items-center gap-1 btn-press"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> সব পড়া হয়েছে
                </button>
              )}
              <button onClick={() => setOpen(false)} className="btn-press p-1 rounded-lg">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto divide-y divide-border">
              {items.length === 0 && (
                <p className="p-6 text-center text-xs text-muted-foreground font-bold">
                  এখনো কোনো নোটিফিকেশন নেই
                </p>
              )}
              {items.map((n) => (
                <div key={n.id} className={`p-3 ${n.read ? "" : "bg-violet-500/5"}`}>
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-border" : "bg-rose-500 animate-pulse"}`}
                    />
                    <div className="min-w-0 flex-1">
                      {n.title && <p className="text-xs font-black leading-tight">{n.title}</p>}
                      <p className="text-[11px] text-muted-foreground whitespace-pre-line leading-snug mt-0.5">
                        {n.body}
                      </p>
                      <p className="text-[9px] text-muted-foreground/70 mt-1 font-bold">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
