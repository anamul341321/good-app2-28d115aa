import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListAnnouncements, adminCreateAnnouncement,
  adminToggleAnnouncement, adminDeleteAnnouncement,
} from "@/lib/announcements.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, Trash2, Power, Send, Bell, BellRing, Smartphone } from "lucide-react";
import {
  adminListUserNotices, adminSendUserNotice, adminDeleteUserNotice,
  adminBroadcastPush, adminListPushTargets, adminAddPushTarget,
  adminRemovePushTarget, adminTestAdminPush,
} from "@/lib/admin.functions";

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

      <PushBroadcast />
      <AdminDevices />
      <PersonalNotice />
    </div>
  );
}

function PersonalNotice() {
  const qc = useQueryClient();
  const [uid, setUid] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["admin-user-notices"], queryFn: () => adminListUserNotices() });

  const send = useMutation({
    mutationFn: () => adminSendUserNotice({ data: { uid: Number(uid), title: title.trim() || null, body: body.trim() } }),
    onSuccess: (r: any) => {
      toast.success(`✅ UID ${r.uid} ${r.name ?? ""} — মেসেজ পাঠানো হয়েছে`);
      setBody(""); setTitle("");
      qc.invalidateQueries({ queryKey: ["admin-user-notices"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminDeleteUserNotice({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-user-notices"] }),
  });

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Send className="w-5 h-5 text-rose" />
        <h2 className="font-black text-base text-rose">নির্দিষ্ট ইউজারকে মেসেজ (UID)</h2>
      </div>
      <p className="text-[11px] text-muted-foreground">
        UID দিয়ে পাঠালে ওই ইউজারের অ্যাপের উপরে লাল নোটিশ হয়ে ভেসে থাকবে — সে নিজে বন্ধ না করা পর্যন্ত।
      </p>
      <input value={uid} onChange={(e) => setUid(e.target.value.replace(/\D/g, ""))}
        inputMode="numeric" placeholder="UID (যেমন 1184)"
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-rose mono-num" />
      <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))}
        placeholder="শিরোনাম (ঐচ্ছিক)"
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-rose" />
      <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 2000))} rows={4}
        placeholder="মেসেজ লিখুন…"
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-rose resize-y" />
      <button onClick={() => send.mutate()} disabled={send.isPending || !uid || body.trim().length < 2}
        className="w-full py-2.5 rounded-xl gradient-cta font-black text-sm disabled:opacity-50">
        {send.isPending ? "পাঠানো হচ্ছে…" : "মেসেজ পাঠান"}
      </button>

      {isLoading ? (
        <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-rose" /></div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((n: any) => (
            <div key={n.id} className="rounded-xl border border-border p-2.5">
              <p className="text-[11px] font-black">
                UID {n.uid} • {n.name ?? "—"} {n.read ? <span className="text-emerald">• পড়েছে</span> : <span className="text-amber">• অপঠিত</span>}
              </p>
              <p className="text-[11.5px] font-bold mt-0.5 whitespace-pre-wrap">{n.body}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                <button onClick={() => remove.mutate(n.id)}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg border border-rose/40 text-rose flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
          {(data ?? []).length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-4">এখনও কোনো ব্যক্তিগত মেসেজ পাঠানো হয়নি</p>
          )}
        </div>
      )}
    </div>
  );
}

/** সব ইউজারের ফোনে notification পাঠানো (অ্যাপ বন্ধ থাকলেও যাবে) */
function PushBroadcast() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [alsoInApp, setAlsoInApp] = useState(true);

  const send = useMutation({
    mutationFn: () =>
      adminBroadcastPush({ data: { title: title.trim(), body: body.trim(), alsoInApp } }),
    onSuccess: (r: any) => {
      toast.success(`✅ ${r.sent}টি ফোনে notification গেছে (মোট ডিভাইস ${r.devices})`);
      setTitle(""); setBody("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BellRing className="w-5 h-5 text-cyan" />
        <h2 className="font-black text-base text-cyan">সব ইউজারকে Notification</h2>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        নেটিভ অ্যাপ ইনস্টল করা সব ফোনের উপরে notification আসবে — ইউজার অ্যাপের ভেতরে না থাকলেও।
      </p>
      <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))}
        placeholder="শিরোনাম (যেমন: 🎁 নতুন বোনাস অফার)"
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-cyan" />
      <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 500))} rows={3}
        placeholder="মেসেজ লিখুন…"
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-cyan resize-y" />
      <label className="flex items-center gap-2 text-[11px] font-bold">
        <input type="checkbox" checked={alsoInApp} onChange={(e) => setAlsoInApp(e.target.checked)} />
        অ্যাপের ভেতরের নোটিফিকেশন বেল-এও দেখাবে
      </label>
      <button onClick={() => send.mutate()}
        disabled={send.isPending || title.trim().length < 2 || body.trim().length < 2}
        className="w-full py-2.5 rounded-xl gradient-cta font-black text-sm disabled:opacity-50">
        {send.isPending ? "পাঠানো হচ্ছে…" : "🔔 সবাইকে পাঠান"}
      </button>
    </div>
  );
}

/** কোন কোন ফোনে অ্যাডমিন alert (নতুন withdraw ইত্যাদি) যাবে */
function AdminDevices() {
  const qc = useQueryClient();
  const [uid, setUid] = useState("");
  const [label, setLabel] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["admin-push-targets"], queryFn: () => adminListPushTargets() });

  const add = useMutation({
    mutationFn: () => adminAddPushTarget({ data: { uid: Number(uid), label: label.trim() || null } }),
    onSuccess: () => { toast.success("যোগ হয়েছে"); setUid(""); setLabel(""); qc.invalidateQueries({ queryKey: ["admin-push-targets"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => adminRemovePushTarget({ data: { userId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-push-targets"] }),
  });
  const test = useMutation({
    mutationFn: () => adminTestAdminPush(),
    onSuccess: (r: any) => toast.success(`টেস্ট পাঠানো হয়েছে — ${r.sent}টি ফোনে গেছে`),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-amber" />
        <h2 className="font-black text-base text-amber">অ্যাডমিন Notification ফোন</h2>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        এখানে নিজের অ্যাকাউন্টের UID যোগ করুন। ওই অ্যাকাউন্টে নেটিভ অ্যাপ (APK) দিয়ে লগইন করা
        থাকলে — নতুন withdraw রিকোয়েস্ট এলে আপনার ফোনে সাথে সাথেই notification আসবে,
        অ্যাডমিন প্যানেল খোলা না থাকলেও।
      </p>
      <div className="flex gap-2">
        <input value={uid} onChange={(e) => setUid(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
          placeholder="আপনার UID" className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-amber mono-num" />
        <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 60))}
          placeholder="নাম (ঐচ্ছিক)" className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-amber" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => add.mutate()} disabled={add.isPending || !uid}
          className="flex-1 py-2.5 rounded-xl gradient-cta font-black text-sm disabled:opacity-50">
          {add.isPending ? "যোগ হচ্ছে…" : "যোগ করুন"}
        </button>
        <button onClick={() => test.mutate()} disabled={test.isPending}
          className="px-3 py-2.5 rounded-xl border border-amber/40 text-amber font-black text-[12px] disabled:opacity-50">
          {test.isPending ? "…" : "টেস্ট"}
        </button>
      </div>

      {isLoading ? (
        <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-amber" /></div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((t: any) => (
            <div key={t.userId} className="rounded-xl border border-border p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11.5px] font-black truncate">
                  UID {t.uid ?? "—"} • {t.name ?? "—"} {t.label ? `(${t.label})` : ""}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Smartphone className="w-3 h-3" /> {t.devices}টি ফোন রেজিস্টার্ড
                  {t.devices === 0 ? " — নেটিভ অ্যাপে লগইন করুন" : ""}
                </p>
              </div>
              <button onClick={() => remove.mutate(t.userId)}
                className="text-[11px] font-bold px-2 py-1 rounded-lg border border-rose/40 text-rose flex items-center gap-1 shrink-0">
                <Trash2 className="w-3 h-3" /> সরান
              </button>
            </div>
          ))}
          {(data ?? []).length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-3">এখনও কোনো অ্যাডমিন ফোন যোগ করা হয়নি</p>
          )}
        </div>
      )}
    </div>
  );
}
