/**
 * ভিডিও/গান দেখার ইতিহাস (YouTube-এর মতো) — ডিভাইসেই সেভ থাকে,
 * পরে চাইলে সেখান থেকেই আবার চালানো যায়।
 */
import type { ExternalReelVideo } from "@/lib/feed-api";

const HISTORY_KEY = "goodapp_video_history_v1";
const MAX_ITEMS = 120;

export type WatchHistoryItem = ExternalReelVideo & { watched_at: number };

export function readWatchHistory(): WatchHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((item) => item && typeof item.id === "string");
  } catch {
    return [];
  }
}

export function addWatchHistory(video: ExternalReelVideo): WatchHistoryItem[] {
  if (typeof window === "undefined") return [];
  const list = readWatchHistory().filter((item) => item.id !== video.id);
  const next = [{ ...video, watched_at: Date.now() }, ...list].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
  return next;
}

export function removeWatchHistory(id: string): WatchHistoryItem[] {
  const next = readWatchHistory().filter((item) => item.id !== id);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
  return next;
}

export function clearWatchHistory(): void {
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    // no-op
  }
}

export function watchedAgoLabel(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "এখনই";
  if (mins < 60) return `${mins} মিনিট আগে`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ঘণ্টা আগে`;
  const days = Math.round(hrs / 24);
  return `${days} দিন আগে`;
}
