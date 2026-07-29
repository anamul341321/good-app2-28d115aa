import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bot, Loader2, Save, Plus, Trash2, ShieldAlert, MessageSquare, Link2, CheckCircle2, XCircle,
  Image as ImageIcon, Search, Send, Ban, ShieldCheck, HelpCircle,
} from "lucide-react";
import {
  tgGetSettings, tgSaveSettings, tgRegisterWebhook,
  tgListFaq, tgUpsertFaq, tgDeleteFaq, tgLookupUid, tgSendToGroup,
  tgListBanRequests, tgResolveBanRequest, tgUnban, tgRecentMessages,
  tgListBlocked, tgSetBlocked, tgListVideos, tgUpsertVideo, tgDeleteVideo,
  tgListVoices, tgUpsertVoice, tgDeleteVoice,
} from "@/lib/telegram-bot.functions";


export const Route = createFileRoute("/admin/telegram")({ component: TelegramAdmin });

type Tab = "settings" | "faq" | "voices" | "videos" | "lookup" | "blocked" | "bans" | "log";


function TelegramAdmin() {
  const [tab, setTab] = useState<Tab>("settings");
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-cyan" />
          <h2 className="font-black text-lg">Telegram Bot</h2>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          গ্রুপ মডারেশন, AI অটো-রিপ্লাই ও ban approval — সব এখান থেকে নিয়ন্ত্রণ করুন।
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
        {([
          ["settings", "সেটিংস"], ["faq", "উত্তর/নিয়ম"], ["voices", "ভয়েস"], ["videos", "ভিডিও লিংক"], ["lookup", "UID লুকআপ"],
          ["blocked", "ব্লক লিস্ট"], ["bans", "Ban requests"], ["log", "Activity"],
        ] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black border ${
              tab === k ? "gradient-cta border-transparent" : "bg-surface-2 border-border text-muted-foreground"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "settings" && <SettingsPanel />}
      {tab === "faq" && <FaqPanel />}
      {tab === "voices" && <VoicePanel />}
      {tab === "videos" && <VideoPanel />}
      {tab === "lookup" && <LookupPanel />}
      {tab === "blocked" && <BlockedPanel />}
      {tab === "bans" && <BansPanel />}
      {tab === "log" && <LogPanel />}


    </div>
  );
}

function Toggle({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!value)}
      className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left ${
        value ? "border-emerald/40 bg-emerald/5" : "border-border bg-surface-2"
      }`}>
      <span>
        <span className="block text-xs font-black">{label}</span>
        {hint && <span className="block text-[10px] text-muted-foreground">{hint}</span>}
      </span>
      <span className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition ${value ? "bg-emerald" : "bg-border"}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${value ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

function SettingsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tg-settings"], queryFn: () => tgGetSettings() });
  const [form, setForm] = useState<any>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (data?.settings && !form) setForm({ ...data.settings, banned_words_text: (data.settings.banned_words ?? []).join(", ") });
    if (typeof window !== "undefined" && !webhookUrl) {
      setWebhookUrl(`${window.location.origin}/api/public/telegram/webhook`);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => tgSaveSettings({
      data: {
        enabled: !!form.enabled,
        auto_reply_enabled: !!form.auto_reply_enabled,
        moderation_enabled: !!form.moderation_enabled,
        photo_analysis_enabled: !!form.photo_analysis_enabled,
        delete_bad_messages: !!form.delete_bad_messages,
        uid_lookup_enabled: form.uid_lookup_enabled !== false,
        ask_uid_message: form.ask_uid_message ?? "",
        slot_reset_enabled: form.slot_reset_enabled !== false,
        ask_slot_message: form.ask_slot_message ?? "",
        smart_mode: form.smart_mode !== false,
        auto_block_enabled: form.auto_block_enabled !== false,
        block_threshold: Number(form.block_threshold) || 5,
        support_username: (form.support_username?.trim() || "@anamulmunni"),
        photo_privacy_enabled: form.photo_privacy_enabled !== false,
        escalate_enabled: form.escalate_enabled !== false,
        reply_variety: form.reply_variety !== false,
        welcome_enabled: form.welcome_enabled !== false,
        welcome_message: form.welcome_message?.trim() || null,
        default_video_url: form.default_video_url?.trim() || null,




        group_chat_id: form.group_chat_id?.trim() || null,
        admin_chat_id: form.admin_chat_id?.trim() || null,
        admin_mention: form.admin_mention?.trim() || null,
        persona: form.persona ?? "",
        rules: form.rules ?? "",
        warn_threshold: Number(form.warn_threshold) || 3,
        banned_words: String(form.banned_words_text ?? "")
          .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 300),

      },
    }),
    onSuccess: () => { toast.success("সেভ হয়েছে"); qc.invalidateQueries({ queryKey: ["tg-settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const register = useMutation({
    mutationFn: () => tgRegisterWebhook({ data: { url: webhookUrl } }),
    onSuccess: (r: any) => {
      if (r.ok) { toast.success("Webhook যুক্ত হয়েছে ✅"); qc.invalidateQueries({ queryKey: ["tg-settings"] }); }
      else toast.error(r.error);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !form) {
    return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;
  }

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div className={`glass rounded-2xl p-4 border ${data?.tokenConfigured ? "border-emerald/40" : "border-rose-500/40"}`}>
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-amber" />
          <h3 className="font-black text-sm">Connection</h3>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Token: {data?.tokenConfigured ? "✅ configured" : "❌ TG_MOD_BOT_TOKEN সেট করা নেই"}
        </p>
        <p className="text-[11px] text-muted-foreground break-all mt-1">
          Webhook: {(data?.webhook as any)?.url || "সেট করা নেই"}
        </p>
        <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
          className="mt-2 w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-[11px] outline-none focus:border-amber" />
        <button onClick={() => register.mutate()} disabled={register.isPending}
          className="mt-2 w-full py-2.5 rounded-xl gradient-cta font-black text-xs disabled:opacity-50">
          {register.isPending ? "যুক্ত হচ্ছে…" : "Webhook যুক্ত করুন"}
        </button>
      </div>

      <ChatIdPicker
        onPick={(id, which) => { set(which === "group" ? "group_chat_id" : "admin_chat_id", id); toast.success("বসানো হয়েছে — নিচে সেভ করুন"); }}
      />


      <div className="glass rounded-2xl p-4 space-y-2">
        <Toggle label="Bot চালু" hint="বন্ধ করলে বট কিছুই করবে না" value={!!form.enabled} onChange={(v) => set("enabled", v)} />
        <Toggle label="AI অটো-রিপ্লাই" hint="ইউজারের প্রশ্নের উত্তর নিজে দেবে" value={!!form.auto_reply_enabled} onChange={(v) => set("auto_reply_enabled", v)} />
        <Toggle label="মডারেশন" hint="স্প্যাম/গালি ধরবে ও সতর্ক করবে" value={!!form.moderation_enabled} onChange={(v) => set("moderation_enabled", v)} />
        <Toggle label="ছবি বিশ্লেষণ" hint="স্ক্রিনশট দেখে উত্তর দেবে" value={!!form.photo_analysis_enabled} onChange={(v) => set("photo_analysis_enabled", v)} />
        <Toggle label="খারাপ মেসেজ ডিলিট" value={!!form.delete_bad_messages} onChange={(v) => set("delete_bad_messages", v)} />
        <Toggle label="UID লুকআপ" hint="UID পেলে সাথে সাথে একাউন্টের সব তথ্য গ্রুপে দেবে"
          value={form.uid_lookup_enabled !== false} onChange={(v) => set("uid_lookup_enabled", v)} />
        <Toggle label="স্লট রিসেট" hint="কেউ স্লট রিসেট চাইলে বট UID ও স্লট নম্বর জিজ্ঞেস করে নিজেই রিসেট করবে"
          value={form.slot_reset_enabled !== false} onChange={(v) => set("slot_reset_enabled", v)} />
        <Toggle label="স্মার্ট মোড 🧠" hint="আপনার লেখা উত্তরে মিল না পেলে বট নিজে বুঝে ভদ্রভাবে উত্তর দেবে"
          value={form.smart_mode !== false} onChange={(v) => set("smart_mode", v)} />
        <Toggle label="ছবি গোপনীয়তা 🔒" hint="কেউ স্লটের ছবি/key চাইলে বট ভদ্রভাবে না বলবে — ছবি সংরক্ষণের কথা কখনো বলবে না"
          value={form.photo_privacy_enabled !== false} onChange={(v) => set("photo_privacy_enabled", v)} />
        <Toggle label="মানুষের মতো ভিন্ন ভিন্ন উত্তর ✨" hint="একই প্রশ্নেও প্রতিবার নতুন ভাষায় উত্তর দেবে"
          value={form.reply_variety !== false} onChange={(v) => set("reply_variety", v)} />
        <Toggle label="না জানলে অ্যাডমিনে পাঠাবে 🙋" hint="উত্তর না জানলে আপনার ইউজারনেম মেনশন করে ইনবক্স করতে বলবে"
          value={form.escalate_enabled !== false} onChange={(v) => set("escalate_enabled", v)} />
        <Toggle label="অটো ব্লক 🚫" hint="বারবার নিয়ম ভাঙলে বট নিজেই গ্রুপ থেকে ব্লক করে দেবে"
          value={form.auto_block_enabled !== false} onChange={(v) => set("auto_block_enabled", v)} />

      </div>


      <div className="glass rounded-2xl p-4 space-y-3">
        <Field label="Group chat ID" hint="খালি রাখলে সব চ্যাটে কাজ করবে"
          value={form.group_chat_id ?? ""} onChange={(v) => set("group_chat_id", v)} />
        <Field label="Admin chat ID" hint="ban alert এখানে যাবে"
          value={form.admin_chat_id ?? ""} onChange={(v) => set("admin_chat_id", v)} />
        <Field label="সাপোর্ট ইউজারনেম" hint="বট উত্তর না জানলে এখানে ইনবক্স করতে বলবে — যেমন @anamulmunni"
          value={form.support_username ?? "@anamulmunni"} onChange={(v) => set("support_username", v)} />
        <Field label="Admin mention" hint="যেমন @yourname"
          value={form.admin_mention ?? ""} onChange={(v) => set("admin_mention", v)} />
        <Field label="কত সতর্কতার পর ban request" type="number"
          value={String(form.warn_threshold ?? 3)} onChange={(v) => set("warn_threshold", v)} />
        <Field label="কত সতর্কতার পর অটো ব্লক" type="number" hint="যেমন ৫ — ৫ বার নিয়ম ভাঙলে গ্রুপ থেকে ব্লক"
          value={String(form.block_threshold ?? 5)} onChange={(v) => set("block_threshold", v)} />

        <Area label="UID চাওয়ার মেসেজ" rows={2}
          value={form.ask_uid_message ?? ""} onChange={(v) => set("ask_uid_message", v)} />
        <Area label="স্লট নম্বর চাওয়ার মেসেজ" rows={2}
          value={form.ask_slot_message ?? ""} onChange={(v) => set("ask_slot_message", v)} />
        <Area label="Bot এর পরিচয় / আচরণ" rows={4} value={form.persona ?? ""} onChange={(v) => set("persona", v)} />

        <Area label="গ্রুপের নিয়ম (bot এগুলো মানবে ও শেখাবে)" rows={6} value={form.rules ?? ""} onChange={(v) => set("rules", v)} />

        <Area label="নিষিদ্ধ শব্দ (কমা দিয়ে আলাদা)" rows={3}
          value={form.banned_words_text ?? ""} onChange={(v) => set("banned_words_text", v)} />
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="w-full py-2.5 rounded-xl gradient-cta font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          <Save className="w-4 h-4" /> {save.isPending ? "সেভ হচ্ছে…" : "সেভ করুন"}
        </button>
      </div>
    </div>
  );
}

function ChatIdPicker({ onPick }: { onPick: (id: string, which: "group" | "admin") => void }) {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["tg-chatids"],
    queryFn: () => tgRecentMessages(),
    refetchInterval: 5000,
  });

  const chats = Object.values(
    ((data as any[]) ?? []).reduce((acc: Record<string, any>, m: any) => {
      const key = String(m.chat_id);
      if (!acc[key]) acc[key] = { id: key, name: m.full_name || m.username || "চ্যাট", last: m.text || "", when: m.created_at };
      return acc;
    }, {}),
  ) as any[];

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-black text-sm">চ্যাট আইডি অটো-ডিটেক্ট</h3>
        <button onClick={() => refetch()} className="text-[11px] font-black text-cyan">রিফ্রেশ</button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        ১) বটকে আপনার গ্রুপে অ্যাড করুন (admin বানান)। ২) গ্রুপে যেকোনো একটা মেসেজ লিখুন। ৩) নিচে চ্যাট আইডি নিজে থেকেই চলে আসবে — বাটনে চাপ দিয়ে বসিয়ে সেভ করুন।
      </p>
      <div className="mt-3 space-y-2">
        {chats.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            {isFetching ? "খোঁজা হচ্ছে…" : "এখনো কোনো মেসেজ আসেনি। গ্রুপে একটা মেসেজ লিখুন।"}
          </p>
        )}
        {chats.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-surface-2 p-2.5">
            <p className="text-xs font-black">{c.name}</p>
            <p className="text-[10px] text-muted-foreground break-all">ID: {c.id}</p>
            {c.last && <p className="text-[10px] text-muted-foreground truncate">“{c.last}”</p>}
            <div className="mt-2 flex gap-2">
              <button onClick={() => onPick(c.id, "group")}
                className="flex-1 rounded-lg gradient-cta py-1.5 text-[11px] font-black">Group ID করুন</button>
              <button onClick={() => onPick(c.id, "admin")}
                className="flex-1 rounded-lg border border-border py-1.5 text-[11px] font-black">Admin ID করুন</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function Field({ label, hint, value, onChange, type = "text" }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-black mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-amber" />
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function Area({ label, value, onChange, rows = 4 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <div>
      <label className="block text-[11px] font-black mb-1">{label}</label>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-amber resize-y" />
    </div>
  );
}

function FaqPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tg-faq"], queryFn: () => tgListFaq() });
  const [draft, setDraft] = useState({ topic: "", keywords: "", answer: "", priority: 0 });
  const [img, setImg] = useState<{ b64: string; preview: string } | null>(null);

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 6_000_000) { toast.error("ছবি ৬MB এর কম দিন"); return; }
    const buf = await file.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    setImg({ b64: btoa(bin), preview: URL.createObjectURL(file) });
  };

  const upsert = useMutation({
    mutationFn: (v: any) => tgUpsertFaq({ data: v }),
    onSuccess: () => {
      toast.success("সেভ হয়েছে");
      setDraft({ topic: "", keywords: "", answer: "", priority: 0 });
      setImg(null);
      qc.invalidateQueries({ queryKey: ["tg-faq"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => tgDeleteFaq({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tg-faq"] }),
  });

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4 border border-cyan/30">
        <h3 className="font-black text-sm flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-cyan" /> কোন ঘরে কী লিখবেন (সহজ ব্যাখ্যা)
        </h3>
        <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
          <li>📌 <b className="text-foreground">উত্তর</b> — সবচেয়ে জরুরি ঘর। ইউজার এই সমস্যার কথা বললে বট ঠিক এই কথাটাই বলবে। শুধু এই ঘরটা পূরণ করলেই চলবে।</li>
          <li>🖼️ <b className="text-foreground">রেফারেন্স স্ক্রিনশট</b> — ঐচ্ছিক। ছবি দিলে ইউজার একই রকম ছবি পাঠালেই বট এই উত্তরটা দেবে।</li>
          <li>🏷️ <b className="text-foreground">বিষয়</b> — শুধু আপনার চেনার জন্য নাম (যেমন "উইথড্র দেরি")। খালি রাখলে আমরা নিজেরাই নাম বসিয়ে দেব।</li>
          <li>🔑 <b className="text-foreground">কীওয়ার্ড</b> — ঐচ্ছিক। ইউজার কোন শব্দ লিখলে এই উত্তর দেবে (যেমন: withdraw, টাকা, দেরি)। খালি রাখলেও বট নিজে বুঝে নেবে।</li>
        </ul>
      </div>

      <div className="glass rounded-2xl p-4 space-y-2">
        <h3 className="font-black text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-emerald" /> নতুন উত্তর যোগ করুন</h3>
        <p className="text-[10px] text-muted-foreground">
          শুধু <b>উত্তর</b> লিখুন (চাইলে ছবি দিন) — বাকিটা ঐচ্ছিক।
        </p>
        <Area label="উত্তর (এটাই বট বলবে)" rows={5} value={draft.answer} onChange={(v) => setDraft({ ...draft, answer: v })} />

        <div>
          <label className="block text-[11px] font-black mb-1">রেফারেন্স স্ক্রিনশট (ঐচ্ছিক)</label>
          <div className="flex items-center gap-2">
            <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-border bg-surface-2 px-3 py-2.5 text-[11px] font-black text-center">
              <ImageIcon className="w-3.5 h-3.5 inline mr-1 text-cyan" />
              {img ? "ছবি বদলান" : "ছবি নির্বাচন করুন"}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>
            {img && (
              <button onClick={() => setImg(null)} className="p-2 rounded-lg bg-surface-2 border border-border">
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              </button>
            )}
          </div>
          {img && <img src={img.preview} alt="preview" className="mt-2 h-28 rounded-xl border border-border object-cover" />}
        </div>

        <Field label="বিষয় (ঐচ্ছিক — নিজের চেনার জন্য)" value={draft.topic} onChange={(v) => setDraft({ ...draft, topic: v })} />
        <Field label="কীওয়ার্ড (ঐচ্ছিক, কমা দিয়ে)" value={draft.keywords} onChange={(v) => setDraft({ ...draft, keywords: v })} />

        <button
          onClick={() => {
            if (!draft.answer.trim()) { toast.error("উত্তর লিখুন"); return; }
            const auto = draft.answer.trim().split(/\s+/).slice(0, 5).join(" ");
            upsert.mutate({
              topic: draft.topic.trim() || (img ? `ছবি: ${auto}` : auto).slice(0, 110),
              keywords: draft.keywords.split(",").map((s) => s.trim()).filter(Boolean),
              answer: draft.answer.trim(), priority: 0, is_active: true,
              image_base64: img?.b64 ?? null,
            });
          }}
          disabled={upsert.isPending}
          className="w-full py-2.5 rounded-xl gradient-cta font-black text-sm disabled:opacity-50">
          {upsert.isPending ? "সেভ হচ্ছে…" : "যোগ করুন"}
        </button>
      </div>


      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>
      ) : (data ?? []).length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6">কোনো উত্তর যোগ করা হয়নি</p>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((f: any) => (
            <div key={f.id} className="glass rounded-xl p-3 border border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{f.topic}</p>
                  <p className="text-[11px] text-muted-foreground whitespace-pre-wrap mt-1">{f.answer}</p>
                  {f.keywords?.length > 0 && (
                    <p className="text-[10px] text-cyan mt-1">🔑 {f.keywords.join(", ")}</p>
                  )}
                  {f.image_url && (
                    <img src={f.image_url} alt={f.topic}
                      className="mt-2 h-24 rounded-lg border border-border object-cover" />
                  )}
                </div>
                <button onClick={() => del.mutate(f.id)} className="shrink-0 p-2 rounded-lg bg-surface-2">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                </button>
              </div>
            </div>

          ))}
        </div>
      )}
    </div>
  );
}

function LookupPanel() {
  const [uid, setUid] = useState("");
  const [card, setCard] = useState<string | null>(null);

  const look = useMutation({
    mutationFn: () => tgLookupUid({ data: { uid: uid.trim() } }),
    onSuccess: (r: any) => {
      if (r.ok) setCard(r.card);
      else { setCard(null); toast.error("এই UID তে কোনো একাউন্ট নেই"); }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => tgSendToGroup({ data: { text: card! } }),
    onSuccess: (r: any) => r.ok ? toast.success("গ্রুপে পাঠানো হয়েছে ✅") : toast.error(r.error),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4 space-y-2">
        <h3 className="font-black text-sm flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan" /> UID দিয়ে একাউন্ট দেখুন
        </h3>
        <p className="text-[10px] text-muted-foreground">
          bot গ্রুপে ঠিক এই তথ্যটাই পাঠায়। এখান থেকে যাচাই করে চাইলে নিজেও গ্রুপে পাঠাতে পারেন।
        </p>
        <div className="flex gap-2">
          <input value={uid} onChange={(e) => setUid(e.target.value)}
            placeholder="UID বা রেফার কোড"
            className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-amber" />
          <button onClick={() => uid.trim() && look.mutate()} disabled={look.isPending}
            className="px-4 rounded-xl gradient-cta font-black text-xs disabled:opacity-50">
            {look.isPending ? "…" : "খুঁজুন"}
          </button>
        </div>
      </div>

      {card && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <pre className="text-[11px] whitespace-pre-wrap leading-relaxed font-[inherit]">
            {card.replace(/<\/?[^>]+>/g, "")}
          </pre>
          <button onClick={() => send.mutate()} disabled={send.isPending}
            className="w-full py-2.5 rounded-xl bg-surface-2 border border-border font-black text-xs flex items-center justify-center gap-2">
            <Send className="w-3.5 h-3.5 text-cyan" /> {send.isPending ? "পাঠানো হচ্ছে…" : "গ্রুপে পাঠান"}
          </button>
        </div>
      )}
    </div>
  );
}



function BansPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tg-bans"], queryFn: () => tgListBanRequests() });
  const [adminName, setAdminName] = useState("");
  const [uids, setUids] = useState<Record<string, string>>({});

  const resolve = useMutation({
    mutationFn: (v: any) => tgResolveBanRequest({ data: v }),
    onSuccess: (r: any) => {
      if (r.ok) { toast.success("সম্পন্ন"); qc.invalidateQueries({ queryKey: ["tg-bans"] }); }
      else toast.error(r.error);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const unban = useMutation({
    mutationFn: (id: string) => tgUnban({ data: { user_id: id } }),
    onSuccess: () => { toast.success("Unban হয়েছে"); qc.invalidateQueries({ queryKey: ["tg-bans"] }); },
  });

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4">
        <Field label="Admin name (কে approve করছে)" value={adminName} onChange={setAdminName} />
      </div>
      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>
      ) : (data ?? []).length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6">কোনো ban request নেই</p>
      ) : (
        (data ?? []).map((r: any) => (
          <div key={r.id} className={`glass rounded-xl p-3 border ${
            r.status === "pending" ? "border-amber/50" : r.status === "approved" ? "border-rose-500/40" : "border-border opacity-70"
          }`}>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber shrink-0" />
              <p className="text-xs font-black truncate">
                {r.full_name}{r.username ? ` (@${r.username})` : ""}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">কারণ: {r.reason}</p>
            {r.evidence && <p className="text-[10px] text-muted-foreground mt-1 italic line-clamp-3">“{r.evidence}”</p>}
            <p className="text-[10px] text-muted-foreground mt-1">
              TG ID: {r.tg_user_id} · App UID: {r.profile?.uid_seq ?? r.matched_uid ?? "—"}
              {r.profile?.display_name ? ` · ${r.profile.display_name}` : ""}
            </p>
            {r.status === "pending" ? (
              <div className="mt-2 space-y-2">
                {!r.app_user_id && (
                  <input placeholder="App UID লিখুন" value={uids[r.id] ?? r.matched_uid ?? ""}
                    onChange={(e) => setUids({ ...uids, [r.id]: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-xs outline-none focus:border-amber" />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => adminName.trim()
                      ? resolve.mutate({ id: r.id, approve: true, admin_name: adminName.trim(), uid: uids[r.id] ?? r.matched_uid ?? "" })
                      : toast.error("Admin name দিন")}
                    className="flex-1 py-2 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-black flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ban approve
                  </button>
                  <button
                    onClick={() => adminName.trim()
                      ? resolve.mutate({ id: r.id, approve: false, admin_name: adminName.trim() })
                      : toast.error("Admin name দিন")}
                    className="flex-1 py-2 rounded-xl bg-surface-2 border border-border text-xs font-black flex items-center justify-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> বাতিল
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[10px] text-muted-foreground">
                  {r.status === "approved" ? "✅ Banned" : "❌ Rejected"} · {r.resolved_by ?? "—"}
                </p>
                {r.status === "approved" && r.app_user_id && r.profile?.banned && (
                  <button onClick={() => unban.mutate(r.app_user_id)}
                    className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-[10px] font-black">
                    Unban
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function LogPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["tg-log"], queryFn: () => tgRecentMessages(), refetchInterval: 15000,
  });
  if (isLoading) return <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;
  if ((data ?? []).length === 0) return <p className="text-center text-xs text-muted-foreground py-6">এখনো কোনো মেসেজ আসেনি</p>;
  return (
    <div className="space-y-2">
      {(data ?? []).map((m: any) => (
        <div key={m.update_id} className="glass rounded-xl p-3 border border-border">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black truncate flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-cyan" /> {m.full_name}
            </p>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              m.verdict === "ok" ? "bg-emerald/15 text-emerald"
                : m.verdict === "question" ? "bg-cyan/15 text-cyan" : "bg-rose-500/15 text-rose-300"
            }`}>{m.verdict}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3">{m.text || (m.has_photo ? "📷 ছবি" : "")}</p>
          {m.bot_reply && <p className="text-[10px] text-emerald mt-1">🤖 {m.bot_reply}</p>}
          <p className="text-[10px] text-muted-foreground mt-1">{m.action} · {new Date(m.created_at).toLocaleString("bn-BD")}</p>
        </div>
      ))}
    </div>
  );
}

function BlockedPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["tg-blocked"], queryFn: () => tgListBlocked(), refetchInterval: 20000,
  });
  const [onlyBlocked, setOnlyBlocked] = useState(true);

  const setBlocked = useMutation({
    mutationFn: (v: { tg_user_id: number; blocked: boolean }) =>
      tgSetBlocked({ data: { ...v, reset_warnings: !v.blocked } }),
    onSuccess: (r: any) => {
      if (r.ok) { toast.success("সম্পন্ন ✅"); qc.invalidateQueries({ queryKey: ["tg-blocked"] }); }
      else toast.error(r.error);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = ((data as any[]) ?? []).filter((r) => (onlyBlocked ? r.blocked : true));

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4">
        <h3 className="font-black text-sm flex items-center gap-2">
          <Ban className="w-4 h-4 text-rose-400" /> ব্লক করা ইউজার
        </h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          বারবার নিয়ম ভাঙলে বট নিজেই গ্রুপ থেকে ব্লক করে দেয়। এখান থেকে যেকোনো সময় আনব্লক করতে পারবেন —
          আনব্লক করলে সতর্কতাও শূন্য হয়ে যাবে।
        </p>
        <div className="mt-2">
          <Toggle label="শুধু ব্লক করা ইউজার দেখাও" value={onlyBlocked} onChange={setOnlyBlocked} />
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6">
          {onlyBlocked ? "কেউ ব্লক করা নেই 🎉" : "কোনো রেকর্ড নেই"}
        </p>
      ) : (
        rows.map((r: any) => (
          <div key={r.tg_user_id}
            className={`glass rounded-xl p-3 border ${r.blocked ? "border-rose-500/50" : "border-border"}`}>
            <div className="flex items-center gap-2">
              {r.blocked ? <Ban className="w-4 h-4 text-rose-400 shrink-0" />
                : <ShieldCheck className="w-4 h-4 text-emerald shrink-0" />}
              <p className="text-xs font-black truncate">
                {r.full_name || "ইউজার"}{r.username ? ` (@${r.username})` : ""}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              TG ID: {r.tg_user_id} · UID: {r.known_uid || "—"} · সতর্কতা: {r.warn_count}
            </p>
            {r.blocked_reason && <p className="text-[10px] text-rose-300 mt-1">কারণ: {r.blocked_reason}</p>}
            <p className="text-[10px] text-muted-foreground mt-1">
              শেষ নিয়মভঙ্গ: {new Date(r.last_offense_at).toLocaleString("bn-BD")}
            </p>
            <button
              onClick={() => setBlocked.mutate({ tg_user_id: r.tg_user_id, blocked: !r.blocked })}
              disabled={setBlocked.isPending}
              className={`mt-2 w-full py-2 rounded-xl text-xs font-black border disabled:opacity-50 ${
                r.blocked
                  ? "bg-emerald/15 border-emerald/50 text-emerald"
                  : "bg-rose-500/15 border-rose-500/50 text-rose-300"
              }`}>
              {r.blocked ? "আনব্লক করুন" : "ব্লক করুন"}
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function VideoPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tg-videos"], queryFn: () => tgListVideos() });
  const [draft, setDraft] = useState({ topic: "", keywords: "", url: "", note: "", priority: 0 });

  const upsert = useMutation({
    mutationFn: (v: any) => tgUpsertVideo({ data: v }),
    onSuccess: () => {
      toast.success("সেভ হয়েছে");
      setDraft({ topic: "", keywords: "", url: "", note: "", priority: 0 });
      qc.invalidateQueries({ queryKey: ["tg-videos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => tgDeleteVideo({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tg-videos"] }),
  });

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4 border border-cyan/30">
        <h3 className="font-black text-sm flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-cyan" /> ভিডিও লিংক লাইব্রেরি
        </h3>
        <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
          কোন সমস্যার জন্য কোন ভিডিও — সেটা এখানে লিখে রাখুন। ইউজার গ্রুপে ভিডিও চাইলে বট
          নিজে থেকেই মিলিয়ে সঠিক লিংকটা দিয়ে দেবে।
        </p>
      </div>

      <div className="glass rounded-2xl p-4 space-y-2">
        <h3 className="font-black text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald" /> নতুন ভিডিও যোগ করুন
        </h3>
        <Field label="বিষয় (যেমন: ফেস ভেরিফিকেশন কীভাবে করবেন)"
          value={draft.topic} onChange={(v) => setDraft({ ...draft, topic: v })} />
        <Field label="ভিডিও লিংক" hint="YouTube বা যেকোনো লিংক"
          value={draft.url} onChange={(v) => setDraft({ ...draft, url: v })} />
        <Field label="কীওয়ার্ড (ঐচ্ছিক, কমা দিয়ে)" hint="যেমন: ভিডিও, ফেস, verify"
          value={draft.keywords} onChange={(v) => setDraft({ ...draft, keywords: v })} />
        <Area label="ছোট নোট (ঐচ্ছিক)" rows={2}
          value={draft.note} onChange={(v) => setDraft({ ...draft, note: v })} />
        <button
          onClick={() => {
            if (!draft.url.trim()) { toast.error("ভিডিও লিংক দিন"); return; }
            upsert.mutate({
              topic: draft.topic.trim() || "ভিডিও টিউটোরিয়াল",
              url: draft.url.trim(),
              note: draft.note.trim() || null,
              keywords: draft.keywords.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50),
              priority: Number(draft.priority) || 0,
              is_active: true,
            });
          }}
          disabled={upsert.isPending}
          className="w-full py-2.5 rounded-xl gradient-cta font-black text-xs disabled:opacity-50">
          {upsert.isPending ? "সেভ হচ্ছে…" : "সেভ করুন"}
        </button>
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>
      ) : (data ?? []).length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-[11px] text-muted-foreground">
          এখনো কোনো ভিডিও লিংক যোগ করা হয়নি।
        </div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((v: any) => (
            <div key={v.id} className="glass rounded-2xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{v.topic}</p>
                  <a href={v.url} target="_blank" rel="noreferrer"
                    className="text-[11px] text-cyan break-all underline">{v.url}</a>
                  {v.note && <p className="text-[10px] text-muted-foreground mt-1">{v.note}</p>}
                  {!!(v.keywords ?? []).length && (
                    <p className="text-[10px] text-muted-foreground mt-1">🔑 {(v.keywords ?? []).join(", ")}</p>
                  )}
                </div>
                <button onClick={() => del.mutate(v.id)}
                  className="shrink-0 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function VoicePanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tg-voices"], queryFn: () => tgListVoices() });
  const [draft, setDraft] = useState({ topic: "", keywords: "", note: "" });
  const [audio, setAudio] = useState<{ b64: string; ext: string; name: string; preview: string } | null>(null);

  const pickAudio = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 12_000_000) { toast.error("ভয়েস ফাইল ১২MB এর কম দিন"); return; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const ext = (file.name.split(".").pop() || "ogg").toLowerCase();
    setAudio({ b64: btoa(bin), ext, name: file.name, preview: URL.createObjectURL(file) });
  };

  const upsert = useMutation({
    mutationFn: (v: any) => tgUpsertVoice({ data: v }),
    onSuccess: () => {
      toast.success("ভয়েস সেভ হয়েছে");
      setDraft({ topic: "", keywords: "", note: "" });
      setAudio(null);
      qc.invalidateQueries({ queryKey: ["tg-voices"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => tgDeleteVoice({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tg-voices"] }),
  });

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4 border border-cyan/30">
        <h3 className="font-black text-sm flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-cyan" /> ভয়েস লাইব্রেরি — কীভাবে কাজ করে
        </h3>
        <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
          <li>🎙️ <b className="text-foreground">বিষয়</b> লিখুন (যেমন "রি-ভেরিফাই হচ্ছে না") আর ঐ বিষয়ের একটা ভয়েস রেকর্ড করে আপলোড করুন।</li>
          <li>🤖 কেউ গ্রুপে ঐ সমস্যার কথা বললে বট লেখা উত্তরের সাথে <b className="text-foreground">এই ভয়েসটাই</b> পাঠিয়ে দেবে।</li>
          <li>🎬 একই বিষয়ে ভিডিও লিংক থাকলে সেটাও দেবে। কিছুই না থাকলে বট নিজে সুন্দর করে বাংলায় সমাধান বুঝিয়ে দেবে।</li>
          <li>💡 সবচেয়ে ভালো হয় WhatsApp/Telegram-এ রেকর্ড করা <b className="text-foreground">.ogg</b> ভয়েস দিলে — mp3 দিলেও চলবে।</li>
        </ul>
      </div>

      <div className="glass rounded-2xl p-4 space-y-2">
        <h3 className="font-black text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald" /> নতুন ভয়েস যোগ করুন
        </h3>
        <Field label="বিষয় (কোন সমস্যার ভয়েস)"
          value={draft.topic} onChange={(v) => setDraft({ ...draft, topic: v })} />
        <div>
          <label className="block text-[11px] font-black mb-1">ভয়েস ফাইল</label>
          <label className="block cursor-pointer rounded-xl border border-dashed border-border bg-surface-2 px-3 py-2.5 text-[11px] font-black text-center">
            🎙️ {audio ? audio.name : "ভয়েস ফাইল বাছুন"}
            <input type="file" accept="audio/*" className="hidden"
              onChange={(e) => pickAudio(e.target.files?.[0])} />
          </label>
          {audio && <audio controls src={audio.preview} className="mt-2 w-full" />}
        </div>
        <Field label="কীওয়ার্ড (ঐচ্ছিক, কমা দিয়ে)" hint="যেমন: রি-ভেরিফাই, reverify, হচ্ছে না"
          value={draft.keywords} onChange={(v) => setDraft({ ...draft, keywords: v })} />
        <Area label="ছোট নোট (ঐচ্ছিক)" rows={2}
          value={draft.note} onChange={(v) => setDraft({ ...draft, note: v })} />
        <button
          onClick={() => {
            if (!audio) { toast.error("ভয়েস ফাইল দিন"); return; }
            upsert.mutate({
              topic: draft.topic.trim() || "ভয়েস সহায়তা",
              keywords: draft.keywords.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50),
              note: draft.note.trim() || null,
              priority: 0,
              is_active: true,
              audio_base64: audio.b64,
              audio_ext: audio.ext,
            });
          }}
          disabled={upsert.isPending}
          className="w-full py-2.5 rounded-xl gradient-cta font-black text-xs disabled:opacity-50">
          {upsert.isPending ? "আপলোড হচ্ছে…" : "সেভ করুন"}
        </button>
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>
      ) : (data ?? []).length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-[11px] text-muted-foreground">
          এখনো কোনো ভয়েস যোগ করা হয়নি।
        </div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((v: any) => (
            <div key={v.id} className="glass rounded-2xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black truncate">🎧 {v.topic}</p>
                  {v.note && <p className="text-[10px] text-muted-foreground mt-0.5">{v.note}</p>}
                  {!!(v.keywords ?? []).length && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">🔑 {(v.keywords ?? []).join(", ")}</p>
                  )}
                  {v.audio_url && <audio controls src={v.audio_url} className="mt-2 w-full" />}
                </div>
                <button onClick={() => del.mutate(v.id)}
                  className="shrink-0 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
