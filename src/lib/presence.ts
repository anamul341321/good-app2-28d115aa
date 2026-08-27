/**
 * অনলাইন/অ্যাকটিভ স্ট্যাটাস — Supabase Realtime presence দিয়ে (মেসেঞ্জারের
 * সবুজ ডটের মতো)। পুরো অ্যাপে একটিই চ্যানেল খোলে, সব কম্পোনেন্ট সেটি শেয়ার করে।
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let channel: any = null;
let joining: Promise<void> | null = null;
let refCount = 0;
let online = new Set<string>();
const listeners = new Set<(ids: Set<string>) => void>();

function emit() {
  for (const l of listeners) l(new Set(online));
}

async function join() {
  if (channel) return;
  if (joining) return joining;
  joining = doJoin().finally(() => {
    joining = null;
  });
  return joining;
}

async function doJoin() {
  if (channel) return;
  const { data } = await supabase.auth.getSession();
  const me = data.session?.user?.id;
  if (!me) return;
  channel = supabase.channel("presence-online", { config: { presence: { key: me } } });
  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      online = new Set(Object.keys(state));
      emit();
    })
    .subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ at: Date.now() });
        void touchPresence();
      }
    });
}

/** ডেটা অন + অ্যাপ খোলা থাকলেই সার্ভারে "last active" আপডেট হবে */
export async function touchPresence() {
  try {
    await (supabase as any).rpc("touch_presence");
  } catch {
    /* offline — পরের হার্টবিটে হবে */
  }
}

function leave() {
  if (!channel) return;
  supabase.removeChannel(channel);
  channel = null;
  online = new Set();
  emit();
}

/** অনলাইন ইউজারদের আইডি সেট */
export function usePresence() {
  const [ids, setIds] = useState<Set<string>>(() => new Set(online));

  useEffect(() => {
    refCount += 1;
    listeners.add(setIds);
    void join();
    const beat = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (channel) void channel.track({ at: Date.now() });
      void touchPresence();
    }, 45_000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (channel) void channel.track({ at: Date.now() });
      void touchPresence();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(beat);
      listeners.delete(setIds);
      refCount -= 1;
      if (refCount <= 0) leave();
    };
  }, []);

  return ids;
}

/** একজন এখন অনলাইন কি না */
export function useIsOnline(userId?: string | null) {
  const ids = usePresence();
  return !!userId && ids.has(userId);
}

/** কল দেওয়ার আগে জানা — অন্যপাশে কেউ আছে কি (রিং হবে নাকি শুধু "কল হচ্ছে") */
export function isUserOnlineNow(userId: string) {
  return online.has(userId);
}
