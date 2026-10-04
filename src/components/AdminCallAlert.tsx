import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { PhoneIncoming } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORT_LOBBY } from "@/lib/support-rtc";

/** অ্যাডমিন প্যানেলের যেকোনো পাতায় থাকলে কল আসার বার্তা দেখায়। */
export function AdminCallAlert() {
  const { pathname } = useLocation();
  const [calls, setCalls] = useState<Record<string, { name: string | null; at: number }>>({});

  useEffect(() => {
    const ch = supabase.channel(SUPPORT_LOBBY, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "ring" }, ({ payload }: any) => setCalls((m) => ({ ...m, [payload.id]: { name: payload.name, at: Date.now() } })))
      .on("broadcast", { event: "taken" }, ({ payload }: any) => setCalls((m) => { const n = { ...m }; delete n[payload.id]; return n; }))
      .subscribe();
    const t = window.setInterval(() => setCalls((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => Date.now() - v.at < 8000))), 2000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, []);

  const list = Object.values(calls);
  if (!list.length || pathname.startsWith("/admin/calls")) return null;
  return (
    <Link to="/admin/calls"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-2xl animate-pulse">
      <PhoneIncoming className="h-5 w-5" /> {list[0].name ?? "অতিথি"} কল করছেন — ধরুন
    </Link>
  );
}
