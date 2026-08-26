import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ScanFace, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getProfileHistory } from "@/lib/profile.functions";

const WARNING_KEY = "good-app-face-warning-date";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/** Skipped face signup users retain full app access, with a daily reminder until verified. */
export function DailyFaceVerificationWarning() {
  const { data } = useQuery({
    queryKey: ["profile-history"],
    queryFn: () => getProfileHistory(),
    staleTime: 60_000,
  });
  const [showDailyWarning, setShowDailyWarning] = useState(false);
  const hasVerifiedFace = (data?.tasks ?? []).some(
    (task: any) => task.status === "done" && (task.whitelist_ok ?? true),
  );
  const needsVerification = Boolean(data) && !hasVerifiedFace;

  useEffect(() => {
    if (!needsVerification) return;
    try {
      setShowDailyWarning(localStorage.getItem(WARNING_KEY) !== todayKey());
    } catch {
      setShowDailyWarning(true);
    }
  }, [needsVerification]);

  if (!needsVerification) return null;

  const dismissForToday = () => {
    try {
      localStorage.setItem(WARNING_KEY, todayKey());
    } catch {
      // The persistent banner remains available when storage is unavailable.
    }
    setShowDailyWarning(false);
  };

  return (
    <>
      <div className="sticky top-[calc(env(safe-area-inset-top)+5rem)] z-20 border-y border-rose/40 bg-rose/15 px-3 py-2 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose" />
          <p className="min-w-0 flex-1 text-[11px] font-black leading-snug text-rose">
            ফেস ভেরিফিকেশন বাকি আছে
          </p>
          <Link
            to="/task/$slot"
            params={{ slot: "1" }}
            className="shrink-0 rounded-lg bg-rose px-3 py-1.5 text-[10px] font-black text-primary-foreground"
          >
            এখনই করুন
          </Link>
        </div>
      </div>

      {showDailyWarning && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
          <section className="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-rose/50 bg-surface shadow-2xl">
            <div className="flex items-center justify-between bg-rose/15 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-black text-rose">
                <ScanFace className="h-5 w-5" /> ফেস ভেরিফিকেশন করুন
              </span>
              <button
                type="button"
                aria-label="আজকের জন্য বন্ধ করুন"
                onClick={dismissForToday}
                className="grid h-8 w-8 place-items-center rounded-full text-rose active:bg-rose/15"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-4 text-center">
              <p className="text-sm font-bold leading-relaxed text-foreground">
                আপনি স্কিপ করে অ্যাপের সব সুবিধা ব্যবহার করতে পারবেন। তবে নিরাপত্তার জন্য ফেস
                ভেরিফিকেশন সম্পন্ন করুন। সফল হলে সিস্টেম নিজেই শনাক্ত করবে—কিছু submit করতে হবে না।
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={dismissForToday}
                  className="rounded-xl border border-border bg-surface-2 px-3 py-3 text-xs font-black text-muted-foreground"
                >
                  আজ পরে করব
                </button>
                <Link
                  to="/task/$slot"
                  params={{ slot: "1" }}
                  onClick={dismissForToday}
                  className="rounded-xl bg-rose px-3 py-3 text-xs font-black text-primary-foreground"
                >
                  ভেরিফাই করুন
                </Link>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}