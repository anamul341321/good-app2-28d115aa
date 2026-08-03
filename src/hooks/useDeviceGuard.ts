import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { touchDevice } from "@/lib/sessions.functions";

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

function deviceLabel() {
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
 * এই ডিভাইসটি লগআউট করে দিলে এখানে অটো সাইন-আউট হয়ে যায়।
 * নেটওয়ার্ক সমস্যায় কোনো লগআউট হবে না।
 */
export function useDeviceGuard(onRevoked?: () => void) {
  const touch = useServerFn(touchDevice);

  useEffect(() => {
    let active = true;
    const deviceId = getDeviceId();
    if (!deviceId) return;

    const ping = async () => {
      try {
        // সেশন না থাকলে সার্ভার ফাংশন কল করব না (Unauthorized এড়াতে)
        const { data: sess } = await supabase.auth.getSession();
        if (!sess?.session?.access_token) return;
        const res: any = await touch({
          data: { deviceId, label: deviceLabel(), userAgent: navigator.userAgent },
        });
        if (!active) return;
        if (res?.revoked) {
          toast.error("আপনি অন্য ডিভাইস থেকে এই ফোনটি লগআউট করেছেন");
          await supabase.auth.signOut();
          onRevoked?.();
        }
      } catch {
        /* নেটওয়ার্ক সমস্যা — কিছু করব না */
      }
    };


    ping();
    const timer = setInterval(ping, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
