import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getActivityToday, pingActivity, type ActivityStatus } from "@/lib/activity.functions";

export const DAILY_ACTIVE_REQUIRED = 3600;
const PING_SECONDS = 60;
/** শেষ ট্যাপ/স্ক্রল/টাইপের কত সেকেন্ড পর্যন্ত "অ্যাক্টিভ" ধরা হবে */
const IDLE_LIMIT = 90;

let lastInteractionAt = Date.now();
let listenersBound = false;

function bindInteractionListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;
  const mark = () => {
    lastInteractionAt = Date.now();
  };
  ["pointerdown", "keydown", "touchstart", "wheel", "scroll", "click", "visibilitychange"].forEach((ev) =>
    window.addEventListener(ev, mark, { passive: true }),
  );
}

/** এই মুহূর্তে ইউজার সত্যিই অ্যাপে কাজ করছে কি না (ব্যাকগ্রাউন্ডে ফেলে রাখলে false) */
export function isUserActiveNow() {
  if (typeof document === "undefined") return false;
  if (document.hidden) return false;
  return Date.now() - lastInteractionAt < IDLE_LIMIT * 1000;
}

/**
 * অ্যাপ খোলা ও ইউজার সক্রিয় থাকলে প্রতি ৬০ সেকেন্ডে সার্ভারে সময় জমা হয়।
 * ব্যাকগ্রাউন্ডে ফেলে রাখলে বা ৯০ সেকেন্ড কোনো ট্যাপ/স্ক্রল না করলে সময় গোনা বন্ধ।
 */
export function useActivityTracker() {
  const qc = useQueryClient();

  useEffect(() => {
    bindInteractionListeners();
    let elapsed = 0;
    const tick = setInterval(() => {
      if (!isUserActiveNow()) return;
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

/**
 * সার্ভারের সময় + লোকাল প্রতি-সেকেন্ড গোনা — তাই কাউন্টডাউনে সেকেন্ড নড়াচড়া করে।
 * ইউজার নিষ্ক্রিয় হলে (ব্যাকগ্রাউন্ড/আইডল) সেকেন্ড থেমে যায়।
 */
export function useLiveActiveSeconds() {
  const query = useActivityToday();
  const base = query.data?.seconds ?? 0;
  const [extra, setExtra] = useState(0);
  const baseRef = useRef(base);

  useEffect(() => {
    baseRef.current = base;
    setExtra(0);
  }, [base]);

  useEffect(() => {
    bindInteractionListeners();
    const id = setInterval(() => {
      if (!isUserActiveNow()) return;
      setExtra((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const required = query.data?.required ?? DAILY_ACTIVE_REQUIRED;
  const seconds = Math.min(required, base + extra);
  return { seconds, required, active: isUserActiveNow(), query };
}

export function formatActiveTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h} ঘন্টা ${two(m)} মিনিট ${two(sec)} সেকেন্ড`;
  if (m > 0) return `${m} মিনিট ${two(sec)} সেকেন্ড`;
  return `${sec} সেকেন্ড`;
}
