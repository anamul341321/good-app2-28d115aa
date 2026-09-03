import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getActivityToday, pingActivity, type ActivityStatus } from "@/lib/activity.functions";

export const DAILY_ACTIVE_REQUIRED = 3600;
const PING_SECONDS = 60;

/**
 * অ্যাপ খোলা ও স্ক্রিন সক্রিয় থাকলে প্রতি ৬০ সেকেন্ডে সার্ভারে সময় জমা হয়।
 * ট্যাব লুকানো থাকলে সময় গোনা বন্ধ থাকে — তাই আসল অ্যাক্টিভ সময়ই হিসাব হয়।
 */
export function useActivityTracker() {
  const qc = useQueryClient();

  useEffect(() => {
    let elapsed = 0;
    const tick = setInterval(() => {
      if (document.hidden) return;
      elapsed += 1;
      if (elapsed < PING_SECONDS) return;
      const seconds = elapsed;
      elapsed = 0;
      pingActivity({ data: { seconds } })
        .then((res) => qc.setQueryData(["activity-today"], res))
        .catch(() => {});
    }, 1000);
    return () => clearInterval(tick);
  }, [qc]);
}

/** আজকের অ্যাক্টিভ সময়ের অবস্থা */
export function useActivityToday() {
  return useQuery<ActivityStatus>({
    queryKey: ["activity-today"],
    queryFn: () => getActivityToday(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function formatActiveTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} ঘন্টা ${m} মিনিট`;
  if (m > 0) return `${m} মিনিট ${sec} সেকেন্ড`;
  return `${sec} সেকেন্ড`;
}
