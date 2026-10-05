import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listRecentCalls } from "@/lib/calls.functions";

const fmt = (s: number) => (s < 60 ? `${s} সেকেন্ড` : `${Math.floor(s / 60)} মিনিট ${s % 60} সে.`);

/** রিসেন্ট কল ও সেভ করা UID — ট্যাপ করলে ডায়াল হয় */
export function CallBook({ onDial }: { onDial: (uid: number, video: boolean) => void }) {
  const [tab, setTab] = useState<"recent" | "saved">("recent");
  const qc = useQueryClient();
  const fetchRecent = useServerFn(listRecentCalls);
  const recent = useQuery({ queryKey: ["recent-calls"], queryFn: () => fetchRecent(), staleTime: 15_000 });
  const saved = useQuery({
    queryKey: ["call-contacts"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("call_contacts").select("id, peer_uid, label").order("label");
      return (data ?? []) as { id: string; peer_uid: number; label: string }[];
    },
  });

  const save = async (uid: number, name: string) => {
    const label = window.prompt("কী নামে সেভ করবেন?", name)?.trim();
    if (!label) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await (supabase as any).from("call_contacts")
      .upsert({ owner_id: u.user.id, peer_uid: uid, label: label.slice(0, 60) }, { onConflict: "owner_id,peer_uid" });
    if (error) toast.error("সেভ হয়নি"); else { toast.success("সেভ হয়েছে"); qc.invalidateQueries({ queryKey: ["call-contacts"] }); }
  };
  const remove = async (id: string) => {
    await (supabase as any).from("call_contacts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["call-contacts"] });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-card/90 p-2 shadow">
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-full bg-secondary p-1 text-xs font-black">
        {(["recent", "saved"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full py-1.5 ${tab === t ? "bg-primary text-primary-foreground" : ""}`}>
            {t === "recent" ? "রিসেন্ট কল" : "সেভ করা"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "recent" && (recent.data?.length ? recent.data.map((c) => {
          const Icon = !c.answered && !c.outgoing ? PhoneMissed : c.outgoing ? PhoneOutgoing : PhoneIncoming;
          return (
            <div key={c.id} className="flex items-center gap-2 border-b border-border/40 px-1 py-2 last:border-0">
              <Icon className={`h-4 w-4 shrink-0 ${!c.answered ? "text-destructive" : "text-emerald"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{c.name} {c.uid ? <span className="text-xs text-muted-foreground">· UID {c.uid}</span> : null}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {c.answered ? `কথা হয়েছে ${fmt(c.seconds)}` : c.outgoing ? "ধরেনি" : "মিসড কল"} · {new Date(c.at).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              {c.uid && <button aria-label="সেভ" onClick={() => void save(c.uid!, c.name)} className="p-1.5"><Star className="h-4 w-4" /></button>}
              {c.uid && <button aria-label="কল" onClick={() => onDial(c.uid!, false)} className="rounded-full bg-emerald p-2 text-primary-foreground"><Phone className="h-4 w-4" /></button>}
            </div>
          );
        }) : <p className="py-6 text-center text-xs text-muted-foreground">{recent.isLoading ? "লোড হচ্ছে…" : "এখনো কোনো কল নেই"}</p>)}
        {tab === "saved" && (saved.data?.length ? saved.data.map((s) => (
          <div key={s.id} className="flex items-center gap-2 border-b border-border/40 px-1 py-2 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{s.label}</p>
              <p className="text-[11px] text-muted-foreground">UID {s.peer_uid}</p>
            </div>
            <button aria-label="মুছুন" onClick={() => void remove(s.id)} className="p-1.5"><Trash2 className="h-4 w-4" /></button>
            <button aria-label="কল" onClick={() => onDial(s.peer_uid, false)} className="rounded-full bg-emerald p-2 text-primary-foreground"><Phone className="h-4 w-4" /></button>
          </div>
        )) : <p className="py-6 text-center text-xs text-muted-foreground">রিসেন্ট থেকে ⭐ চেপে নম্বর সেভ করুন</p>)}
      </div>
    </div>
  );
}
