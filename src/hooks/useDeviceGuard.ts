import { useEffect, useState } from "react";
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
 * প্রতি ৬০ সেকেন্ডে নিজের ডিভাইস "জীবিত" জানায়। ইউজার নিজের অন্য ফোন থেকে
 * এই ডিভাইসটি লগআউট করে দিলে এখানে `revoked` true হয় — তখন সাইন-আউট না করে
 * অনুমতি/কোড দিয়ে আবার চালু করার স্ক্রিন দেখানো হয়।
 */
export function useDeviceGuard(enabled = true): boolean {
  const touch = useServerFn(touchDevice);
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const deviceId = getDeviceId();
    if (!deviceId) return;

    const ping = async () => {
      try {
        const { data: sess } = await getSharedSession();
        if (!sess?.session?.access_token) return;
        const res: any = await touch({
          data: { deviceId, label: deviceLabel(), userAgent: navigator.userAgent },
        });
        if (!active) return;
        setRevoked(!!res?.revoked);
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
    // useServerFn can return a new wrapper during renders; only restart the
    // heartbeat when authentication actually becomes enabled/disabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return revoked;
}
