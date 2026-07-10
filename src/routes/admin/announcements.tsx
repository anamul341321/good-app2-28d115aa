import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListAnnouncements, adminCreateAnnouncement,
  adminToggleAnnouncement, adminDeleteAnnouncement,
} from "@/lib/announcements.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, Trash2, Power } from "lucide-react";

export const Route = createFileRoute("/admin/announcements")({ component: AnnouncementsAdmin });

function AnnouncementsAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-announcements"], queryFn: () => adminListAnnouncements() });
  const [msg, setMsg] = useState("");

  const create = useMutation({
    mutationFn: (message: string) => adminCreateAnnouncement({ data: { message } }),
    onSuccess: () => { toast.success("ঘোষণা যোগ হয়েছে"); setMsg(""); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => adminToggleAnnouncement({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-announcements"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminDeleteAnnouncement({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="w-5 h-5 text-amber" />
          <h2 className="font-black text-lg">Announcement টিভি টিকার</h2>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          ইউজারদের হোম পেজে বাম থেকে ডানে scroll হবে (TV news style)।
        </p>
        <textarea
          value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 5000))}
          placeholder="ঘোষণা লিখুন... (৫০০০ অক্ষর পর্যন্ত)" rows={8}
          className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-amber min-h-[180px] resize-y" />
        <p className="text-[10px] text-muted-foreground text-right mt-1">{msg.length} / 5000</p>
        <button
          onClick={() => msg.trim().length >= 2 && create.mutate(msg.trim())}
          disabled={create.isPending || msg.trim().length < 2}
          className="mt-2 w-full py-2.5 rounded-xl gradient-cta font-black text-sm disabled:opacity-50">
          {create.isPending ? "Adding…" : "যোগ করুন"}
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((a: any) => (
            <div key={a.id} className={`glass rounded-xl p-3 border ${a.is_active ? "border-emerald/40" : "border-border opacity-60"}`}>
              <p className="text-sm font-bold">{a.message}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                <div className="flex gap-2">
                  <button onClick={() => toggle.mutate({ id: a.id, active: !a.is_active })}
                    className={`text-[11px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 ${a.is_active ? "text-emerald border-emerald/40" : "text-muted-foreground border-border"}`}>
                    <Power className="w-3 h-3" /> {a.is_active ? "ON" : "OFF"}
                  </button>
                  <button onClick={() => del.mutate(a.id)}
                    className="text-[11px] font-bold px-2 py-1 rounded-lg border border-rose/40 text-rose flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {(data ?? []).length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">এখনও কোনো ঘোষণা নেই</p>
          )}
        </div>
      )}
    </div>
  );
}
