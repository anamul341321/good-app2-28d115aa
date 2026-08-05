import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { touchDevice } from "@/lib/sessions.functions";
import { getSharedSession } from "@/lib/auth-session";

const KEY = "ga_device_id";

export function getDeviceId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() ?? String(Date.now() + Math.random())).slice(0, 40);
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function deviceLabel() {
  if (typeof navigator === "undefined") return "ডিভাইস";
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iOS/i.test(ua)
      ? "iPhone/iPad"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac/i.test(ua)
          ? "Mac"
          : "ডিভাইস";
  const browser = /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : /Firefox/i.test(ua) ? "Firefox" : "ব্রাউজার";
  return `${os} · ${browser}`;
}

/**
 * প্রতি ৩০ সেকেন্ডে নিজের ডিভাইস "জীবিত" জানায় (সেটিংসে ডিভাইস লিস্টের জন্য)।
 * ডিভাইস অনুমতি/approval সিস্টেম বন্ধ — তাই কখনো লক করা হয় না।
 */
export function useDeviceGuard(enabled = true): boolean {
  const touch = useServerFn(touchDevice);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const deviceId = getDeviceId();
    if (!deviceId) return;

    const ping = async () => {
      try {
        const { data: sess } = await getSharedSession();
        if (!sess?.session?.access_token) return;
        if (!active) return;
        await touch({
          data: { deviceId, label: deviceLabel(), userAgent: navigator.userAgent },
        });
      } catch {
        /* নেটওয়ার্ক সমস্যা — কিছু করব না */
      }
    };

    ping();
    const timer = setInterval(ping, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return false;
}

