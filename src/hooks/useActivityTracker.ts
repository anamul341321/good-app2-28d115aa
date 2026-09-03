import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getActivityToday, pingActivity, type ActivityStatus } from "@/lib/activity.functions";

export const DAILY_ACTIVE_REQUIRED = 3600;
const PING_SECONDS = 60;
/** শেষ ট্যাপ/স্ক্রল/টাইপের কত সেকেন্ড পর্যন্ত "অ্যাক্টিভ" ধরা হবে */
const IDLE_LIMIT = 90;

let lastInteractionAt = Date.now();
let listenersBound = false;

/**
 * অটো-ক্লিকার/বট ধরা: মানুষের ট্যাপ-স্ক্রলের gap এলোমেলো হয়,
 * বটের gap প্রায় একই থাকে। পরপর ৮টা ইভেন্টে gap-এর তারতম্য খুব কম হলে
 * (±80ms) সেটাকে রোবটিক ধরে সময় গোনা বন্ধ রাখি — নাহলে Monetag invalid
 * traffic ধরে পুরো অ্যাকাউন্টের earning বন্ধ করে দিতে পারে।
 */
const recentGaps: number[] = [];
let lastEventAt = 0;
let roboticUntil = 0;
let roboticWarnedAt = 0;

function markInteraction() {
  const now = Date.now();
  if (lastEventAt > 0) {
    const gap = now - lastEventAt;
    if (gap > 40 && gap < 4000) {
      recentGaps.push(gap);
      if (recentGaps.length > 8) recentGaps.shift();
      if (recentGaps.length === 8) {
        const avg = recentGaps.reduce((a, b) => a + b, 0) / recentGaps.length;
        const uniform = recentGaps.every((g) => Math.abs(g - avg) < 80);
        if (uniform) {
          roboticUntil = now + 5 * 60_000;
          recentGaps.length = 0;
          // user-কে জানিয়ে দেই যে auto-clicker ধরা পড়েছে, সময় গোনা বন্ধ
          if (now - roboticWarnedAt > 10 * 60_000) {
            roboticWarnedAt = now;
            void import("sonner").then(({ toast }) =>
              toast.warning("⚠️ অটো-ক্লিকার ধরা পড়েছে", {
                description:
                  "নিজে স্ক্রল/ট্যাপ করলেই অ্যাক্টিভ সময় গোনা হবে। মেশিন দিয়ে scroll করলে ১ ঘণ্টা পূরণ হবে না।",
                duration: 8_000,
              }),
            );
          }
        }
      }
    }
  }
  lastEventAt = now;
  if (now < roboticUntil) return;
  lastInteractionAt = now;
}

function bindInteractionListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;
  ["pointerdown", "keydown", "touchstart", "wheel", "scroll", "click", "visibilitychange"].forEach((ev) =>
    window.addEventListener(ev, markInteraction, { passive: true }),
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
