import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { touchDevice } from "@/lib/sessions.functions";
import { supabase } from "@/integrations/supabase/client";
import { clearSharedSession, getSharedSession } from "@/lib/auth-session";

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
 * প্রতি ১৫ সেকেন্ডে নিজের ডিভাইস "জীবিত" জানায়। অন্য ফোন থেকে এই
 * ডিভাইস revoke করা হলে local session মুছে দিয়ে সঙ্গে সঙ্গে login-এ ফেরায়।
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
        const result = await touch({
          data: { deviceId, label: deviceLabel(), userAgent: navigator.userAgent },
        });
        if (!result.revoked || !active) return;
        active = false;
        clearSharedSession();
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        window.location.replace("/auth?reason=device-logout");
      } catch {
        /* নেটওয়ার্ক সমস্যা — কিছু করব না */
      }
    };

    ping();
    const onVisible = () => {
      if (document.visibilityState === "visible") void ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(ping, 15_000);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return false;
}

