import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bot, Loader2, Save, Plus, Trash2, ShieldAlert, MessageSquare, Link2, CheckCircle2, XCircle,
  Image as ImageIcon, Search, Send, Ban, ShieldCheck, HelpCircle, KeyRound,
} from "lucide-react";
import {
  tgGetSettings, tgSaveSettings, tgRegisterWebhook,
  tgListFaq, tgUpsertFaq, tgDeleteFaq, tgLookupUid, tgSendToGroup, tgReplyToUser,
  tgListBanRequests, tgResolveBanRequest, tgUnban, tgRecentMessages,
  tgListBlocked, tgSetBlocked, tgUnfreeze, tgUnfreezeAll, tgListVideos, tgUpsertVideo, tgDeleteVideo,
  tgListVoices, tgUpsertVoice, tgDeleteVoice,
  tgBroadcast, tgBroadcastAudience, tgListLinkedProfiles,
  tgListAiKeys, tgAddAiKey, tgSetAiKeyActive, tgDeleteAiKey,
} from "@/lib/telegram-bot.functions";
import { raceTimeout } from "@/lib/net";
import { BroadcastManager } from "@/components/admin/BroadcastManager";


export const Route = createFileRoute("/admin/telegram")({ component: TelegramAdmin });

type Tab = "settings" | "aikeys" | "started" | "broadcast" | "campaigns" | "faq" | "voices" | "videos" | "lookup" | "blocked" | "bans" | "log";



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
          ["settings", "সেটিংস"], ["aikeys", "AI কী"], ["started", "বট Start (KYC)"], ["broadcast", "ব্রডকাস্ট"], ["campaigns", "ব্যাকগ্রাউন্ড ব্রডকাস্ট"], ["faq", "উত্তর/নিয়ম"], ["voices", "ভয়েস"], ["videos", "ভিডিও লিংক"], ["lookup", "UID লুকআপ"],
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
      {tab === "aikeys" && <AiKeyPanel />}
      {tab === "started" && <StartedPanel />}
      {tab === "broadcast" && <BroadcastPanel />}
      {tab === "campaigns" && <BroadcastManager />}
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
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["tg-settings"],
    queryFn: () => raceTimeout(tgGetSettings(), 12_000, "সেটিংস লোড হচ্ছে না — আবার চেষ্টা করুন"),
  });

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
        kyc_enabled: form.kyc_enabled !== false,
        voice_reply_enabled: form.voice_reply_enabled !== false,
        voice_text_enabled: form.voice_text_enabled !== false,
        welcome_message: form.welcome_message?.trim() || null,
        default_video_url: form.default_video_url?.trim() || null,
        website_url: form.website_url?.trim() || null,
        download_url: form.download_url?.trim() || null,




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

  if (error) {
    return (
      <div className="glass rounded-2xl p-5 text-center space-y-3">
        <p className="text-xs font-black text-rose-300">{(error as any)?.message || "লোড হয়নি"}</p>
        <button onClick={() => refetch()} disabled={isFetching}
          className="rounded-xl gradient-cta px-4 py-2 text-xs font-black">
          {isFetching ? "চেষ্টা হচ্ছে…" : "আবার চেষ্টা করুন"}
        </button>
      </div>
    );
  }

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
        <Toggle label="KYC চালু" hint="এটি অন থাকলে বাকি সব বন্ধ থাকলেও সবাই KYC করতে পারবে (অন্য কোনো রিপ্লাই যাবে না)"
          value={form.kyc_enabled !== false} onChange={(v) => set("kyc_enabled", v)} />
        <Toggle label="Bot চালু" hint="বন্ধ করলে বট শুধু KYC করবে, আর কিছুই করবে না" value={!!form.enabled} onChange={(v) => set("enabled", v)} />
        <Toggle label="ভয়েস রিপ্লাই 🎤" hint="বট মেয়ে-কণ্ঠে বাংলায় ভয়েসেও উত্তর দেবে"
          value={form.voice_reply_enabled !== false} onChange={(v) => set("voice_reply_enabled", v)} />
        <Toggle label="ভয়েসের সাথে লেখাও 📝" hint="অন = ভয়েস + লেখা দুটোই যাবে · অফ = শুধু ভয়েস যাবে, লেখা যাবে না"
          value={form.voice_text_enabled !== false} onChange={(v) => set("voice_text_enabled", v)} />
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
        <Toggle label="নতুন মেম্বারকে স্বাগতম 🎉" hint="কেউ গ্রুপে জয়েন করলে বট সুন্দর করে ওয়েলকাম জানাবে"
          value={form.welcome_enabled !== false} onChange={(v) => set("welcome_enabled", v)} />


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

        <Field label="ডিফল্ট ভিডিও লিংক 📺" hint="কেউ 'কিভাবে কাজ করবো / ভিডিও দিন' বললে এই লিংকটি যাবে"
          value={form.default_video_url ?? ""} onChange={(v) => set("default_video_url", v)} />

        <Field label="ওয়েবসাইট লিংক 🌐" hint="বট ওয়েলকাম ও উত্তরে এই লিংক দেবে"
          value={form.website_url ?? ""} onChange={(v) => set("website_url", v)} />
        <Field label="অ্যাপ ডাউনলোড লিংক 📲" hint="বট অবশ্যই অ্যাপ ডাউনলোড করার কথা বলবে"
          value={form.download_url ?? ""} onChange={(v) => set("download_url", v)} />

        <Area label="UID চাওয়ার মেসেজ" rows={2}
          value={form.ask_uid_message ?? ""} onChange={(v) => set("ask_uid_message", v)} />
        <Area label="স্লট নম্বর চাওয়ার মেসেজ" rows={2}
          value={form.ask_slot_message ?? ""} onChange={(v) => set("ask_slot_message", v)} />
        <Area label="ওয়েলকাম মেসেজ 🎉 ({name} = নাম, {video} = ভিডিও লিংক)" rows={5}
          value={form.welcome_message ?? ""} onChange={(v) => set("welcome_message", v)} />
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
    refetchInterval: 15000,
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
          <li>❓ <b className="text-foreground">প্রশ্ন / সমস্যা</b> — শুধু ইউজার যা বলে সেটাই লিখুন। যেমন: “ক্যামেরা কাজ করছে না”।</li>
          <li>🖼️ <b className="text-foreground">স্ক্রিনশট</b> — ঐচ্ছিক। ছবি দিলে ইউজার একই রকম ছবি পাঠালেই বট এই বিষয়টি ধরে ফেলবে।</li>
          <li>✍️ <b className="text-foreground">উত্তর</b> — <b className="text-foreground">ঐচ্ছিক</b>। খালি রাখলে বট নিজেই অ্যাপের নিয়ম ও ডেটাবেজ দেখে উত্তর বানিয়ে দেবে।</li>
        </ul>
      </div>

      <div className="glass rounded-2xl p-4 space-y-2">
        <h3 className="font-black text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-emerald" /> নতুন প্রশ্ন যোগ করুন</h3>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          সহজ নিয়ম: <b>প্রশ্ন</b> লিখুন → চাইলে <b>ছবি</b> দিন → <b>যোগ করুন</b> চাপুন। উত্তর না লিখলেও চলবে।
        </p>
        <Area label="প্রশ্ন / সমস্যা (ইউজার যা বলে)" rows={3} value={draft.topic} onChange={(v) => setDraft({ ...draft, topic: v })} />

        <div>
          <label className="block text-[11px] font-black mb-1">স্ক্রিনশট (ঐচ্ছিক)</label>
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

        <Area label="উত্তর (ঐচ্ছিক — খালি রাখলে বট নিজেই বলবে)" rows={4} value={draft.answer} onChange={(v) => setDraft({ ...draft, answer: v })} />
        <Field label="ইউজার আরও কী কী লিখতে পারে (ঐচ্ছিক)" hint="কমা দিয়ে লিখুন। যেমন: ক্যামেরা আসছে না, camera permission, face fail" value={draft.keywords} onChange={(v) => setDraft({ ...draft, keywords: v })} />

        <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <b className="text-foreground">মনে রাখুন:</b> শুধু প্রশ্ন ও ছবি দিলেই যথেষ্ট — একই ধরনের প্রশ্ন বা ছবি দেখলে বট নিজেই অ্যাপের নিয়ম অনুযায়ী উত্তর দেবে।
        </div>

        <button
          onClick={() => {
            const question = draft.topic.trim();
            if (!question && !img && !draft.answer.trim()) {
              toast.error("প্রশ্ন লিখুন অথবা ছবি দিন");
              return;
            }
            const auto = (question || draft.answer.trim()).split(/\s+/).slice(0, 8).join(" ");
            upsert.mutate({
              topic: (question || (img ? `ছবি: ${auto}` : auto)).slice(0, 110),
              keywords: [
                ...draft.keywords.split(",").map((s) => s.trim()).filter(Boolean),
                ...(question ? [question.slice(0, 60)] : []),
              ],
              answer: draft.answer.trim() || null, priority: 0, is_active: true,
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
                  <p className="text-[11px] text-muted-foreground whitespace-pre-wrap mt-1">
                    {f.answer || "🤖 উত্তর লেখা নেই — বট নিজেই অ্যাপের নিয়ম দেখে উত্তর দেবে"}
                  </p>
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

      <ReplyToUserPanel />
    </div>
  );
}

function ReplyToUserPanel() {
  const [username, setUsername] = useState("");
  const [messageText, setMessageText] = useState("");
  const [reply, setReply] = useState("");

  const send = useMutation({
    mutationFn: () =>
      tgReplyToUser({
        data: {
          username: username.trim(),
          messageText: messageText.trim() || undefined,
          reply: reply.trim(),
        },
      }),
    onSuccess: (r: any) => {
      if (!r.ok) return toast.error(r.error);
      toast.success(r.repliedTo ? "ইউজারের মেসেজে রিপ্লাই দেওয়া হয়েছে ✅" : r.note || "পাঠানো হয়েছে ✅");
      setReply("");
      setMessageText("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="glass rounded-2xl p-4 space-y-2">
      <h3 className="font-black text-sm flex items-center gap-2">
        <Send className="w-4 h-4 text-amber" /> ইউজারকে বট দিয়ে রিপ্লাই দিন
      </h3>
      <p className="text-[10px] text-muted-foreground">
        ইউজারের টেলিগ্রাম username দিন। কোন মেসেজের রিপ্লাই চান সেটার কিছু অংশ লিখলে বট ঠিক ওই
        মেসেজেই মেনশন করে রিপ্লাই দেবে।
      </p>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="@username"
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-amber"
      />
      <input
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        placeholder="কোন মেসেজের রিপ্লাই? (ঐ মেসেজের কিছু অংশ — না দিলে সর্বশেষ মেসেজ)"
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-xs outline-none focus:border-amber"
      />
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={4}
        placeholder="যে উত্তরটি পাঠাতে চান…"
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-amber"
      />
      <button
        onClick={() => username.trim() && reply.trim() && send.mutate()}
        disabled={send.isPending}
        className="w-full py-2.5 rounded-xl gradient-cta font-black text-xs disabled:opacity-50"
      >
        {send.isPending ? "পাঠানো হচ্ছে…" : "মেনশন করে রিপ্লাই পাঠান"}
      </button>
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

  const [freezeKey, setFreezeKey] = useState("");
  const unfreeze = useMutation({
    mutationFn: (v: { tg_user_id?: number; username?: string; uid?: string }) => tgUnfreeze({ data: v }),
    onSuccess: (r: any) => {
      if (r.ok) {
        toast.success("ফ্রিজ খুলে দেওয়া হয়েছে ✅ — এখন গ্রুপে লিখতে পারবে");
        setFreezeKey("");
        qc.invalidateQueries({ queryKey: ["tg-blocked"] });
      } else toast.error(r.error);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unfreezeAll = useMutation({
    mutationFn: () => tgUnfreezeAll(),
    onSuccess: (r: any) => {
      toast.success(`${r.unfrozen} জনের ফ্রিজ খুলে দেওয়া হয়েছে ✅`);
      qc.invalidateQueries({ queryKey: ["tg-blocked"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitFreeze = () => {
    const v = freezeKey.trim();
    if (!v) return;
    if (v.startsWith("@")) unfreeze.mutate({ username: v });
    else if (/^\d{5,}$/.test(v)) unfreeze.mutate({ tg_user_id: Number(v) });
    else unfreeze.mutate({ uid: v.replace(/\D/g, "") });
  };

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

      <div className="glass rounded-2xl p-4 space-y-2">
        <h3 className="font-black text-sm">❄️ গ্রুপ ফ্রিজ (mute) খুলে দিন</h3>
        <p className="text-[11px] text-muted-foreground">
          কেউ গ্রুপে “you are currently restricted from posting” দেখলে এখানে তার
          <b> TG ID</b>, <b>@username</b> বা অ্যাপের <b>UID</b> দিয়ে সাথে সাথেই ফ্রিজ খুলে দিতে পারবেন।
          লিস্টে না থাকলেও কাজ করবে।
        </p>
        <div className="flex gap-2">
          <input
            value={freezeKey}
            onChange={(e) => setFreezeKey(e.target.value)}
            placeholder="TG ID / @username / UID"
            className="flex-1 bg-surface-2 border border-border rounded-xl h-10 px-3 text-xs font-bold outline-none"
          />
          <button
            onClick={submitFreeze}
            disabled={unfreeze.isPending || !freezeKey.trim()}
            className="gradient-cta rounded-xl px-4 text-xs font-black disabled:opacity-50"
          >
            {unfreeze.isPending ? "..." : "খুলে দিন"}
          </button>
        </div>
        <button
          onClick={() => unfreezeAll.mutate()}
          disabled={unfreezeAll.isPending}
          className="w-full rounded-xl border border-emerald/40 bg-emerald/10 h-10 text-xs font-black text-emerald disabled:opacity-50"
        >
          {unfreezeAll.isPending ? "খোলা হচ্ছে..." : "সবার ফ্রিজ একসাথে খুলে দিন"}
        </button>
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
            <button
              onClick={() => unfreeze.mutate({ tg_user_id: r.tg_user_id })}
              disabled={unfreeze.isPending}
              className="mt-2 w-full py-2 rounded-xl text-xs font-black border bg-cyan/15 border-cyan/50 text-cyan disabled:opacity-50"
            >
              ❄️ ফ্রিজ খুলে দিন (গ্রুপে লিখতে পারবে)
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

// ---- ব্রডকাস্ট: গ্রুপে / সব লিংকড ইউজারের DM-এ / একজনকে ------------------
function BroadcastPanel() {
  const [target, setTarget] = useState<"group" | "dm" | "one">("dm");
  const [uid, setUid] = useState("");
  const [text, setText] = useState("");

  const { data: audience } = useQuery({
    queryKey: ["tg-broadcast-audience"],
    queryFn: () => tgBroadcastAudience(),
    staleTime: 60_000,
  });

  const send = useMutation({
    mutationFn: () => tgBroadcast({ data: { text, target, uid: uid || undefined } }),
    onSuccess: (r: any) => {
      if (!r?.ok) return toast.error(r?.error ?? "পাঠানো যায়নি");
      toast.success(`পাঠানো হয়েছে: ${r.sent}${r.failed ? ` • ব্যর্থ: ${r.failed}` : ""}`);
      setText("");
    },
    onError: () => toast.error("পাঠানো যায়নি"),
  });

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1.5">
        <Send className="w-3.5 h-3.5 text-cyan" /> ব্রডকাস্ট মেসেজ
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        যারা অ্যাপে “শুরু করুন” চেপেছে তাদের টেলিগ্রাম লিংক হয়ে গেছে — এখন এক ক্লিকেই সবাইকে DM পাঠানো যায়।
        লিংক হয়েছে: <b className="mono-num text-cyan">{audience?.linked ?? 0}</b> জন।
      </p>

      <div className="grid grid-cols-3 gap-2">
        {([["dm", "সব DM"], ["group", "গ্রুপে"], ["one", "একজনকে"]] as [typeof target, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTarget(k)}
            className={`rounded-xl px-2 py-2 text-[11px] font-black border ${
              target === k ? "gradient-cta border-transparent" : "bg-surface-2 border-border text-muted-foreground"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {target === "one" && (
        <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="UID (যেমন 4100)"
          className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-xs font-bold outline-none focus:border-cyan" />
      )}

      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
        placeholder="মেসেজ লিখুন… (HTML চলবে: <b>বোল্ড</b>)"
        className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-xs font-bold outline-none focus:border-cyan" />

      <button onClick={() => send.mutate()} disabled={send.isPending || !text.trim()}
        className="gradient-cta w-full rounded-xl py-3 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50">
        {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        পাঠান
      </button>
      {target === "dm" && (
        <p className="text-[10px] text-muted-foreground">
          ⚠️ অনেকজনকে পাঠাতে কিছুটা সময় লাগবে (Telegram লিমিটের কারণে ধীরে পাঠানো হয়)। যারা বট ব্লক করেছে তাদের ব্যর্থ দেখাবে।
        </p>
      )}
    </div>
  );
}

// ---- কারা বট Start করেছে (টেলিগ্রাম KYC তালিকা) ---------------------------
function StartedPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["tg-linked-profiles"],
    queryFn: () => tgListLinkedProfiles(),
    staleTime: 30_000,
  });
  const [q, setQ] = useState("");

  const rows = (data?.rows ?? []).filter((r: any) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      String(r.uid_seq ?? "").includes(s) ||
      String(r.telegram_user_id ?? "").includes(s) ||
      (r.display_name ?? "").toLowerCase().includes(s) ||
      (r.phone_number ?? "").includes(s)
    );
  });

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1.5">
        <Link2 className="w-3.5 h-3.5 text-cyan" /> বট Start করেছে / KYC হয়েছে
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 border border-border p-3">
          <p className="text-[10px] text-muted-foreground font-bold">মোট Start/KYC</p>
          <p className="text-xl font-black mono-num">{data?.total ?? 0}</p>
        </div>
        <div className="rounded-xl bg-surface-2 border border-border p-3">
          <p className="text-[10px] text-muted-foreground font-bold">একই টেলিগ্রাম একাধিক UID</p>
          <p className="text-xl font-black mono-num text-rose-500">{data?.duplicates ?? 0}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="UID / নাম / ফোন / Telegram ID"
          className="w-full pl-9 pr-3 py-2.5 bg-surface-2 border border-border rounded-xl outline-none focus:border-cyan text-sm" />
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>
      ) : (
        <div className="space-y-2">
          {rows.map((r: any) => (
            <div key={r.id} className={`rounded-xl border p-3 ${r.duplicate ? "border-rose-400 bg-rose-500/5" : "border-border bg-surface-2"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-black text-sm truncate">{r.display_name || "—"}</p>
                <span className="text-[10px] mono-num bg-cyan/15 text-cyan px-2 py-0.5 rounded-full">UID {r.uid_seq}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mono-num">TG ID: {r.telegram_user_id}{r.phone_number ? ` • ${r.phone_number}` : ""}</p>
              <p className="text-[10px] text-muted-foreground">
                {r.kyc_verified || r.telegram_user_id ? "✅ KYC ভেরিফাইড" : "⚠️ KYC হয়নি"} • {r.kyc_verified_at ? new Date(r.kyc_verified_at).toLocaleString() : "—"}
              </p>
              {r.duplicate && (
                <p className="text-[10px] font-black text-rose-500 mt-1">⚠️ এই টেলিগ্রাম দিয়ে একাধিক UID যুক্ত আছে</p>
              )}
            </div>
          ))}
          {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">কেউ পাওয়া যায়নি</p>}
        </div>
      )}
    </div>
  );
}

function AiKeyPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tg-ai-keys"], queryFn: () => tgListAiKeys() });
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");

  const add = useMutation({
    mutationFn: () => tgAddAiKey({ data: { key: key.trim(), label: label.trim() || undefined } }),
    onSuccess: () => {
      setKey(""); setLabel("");
      toast.success("কী সেভ হয়েছে ✅ — এটি এখন থেকেই ব্যবহার হবে");
      qc.invalidateQueries({ queryKey: ["tg-ai-keys"] });
    },
    onError: (e: any) => toast.error(e?.message || "কী সেভ করা যায়নি"),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => tgSetAiKeyActive({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tg-ai-keys"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => tgDeleteAiKey({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tg-ai-keys"] }),
  });

  const keys = data?.keys ?? [];
  const live = keys.filter((k) => k.active && !k.onCooldown).length;

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-cyan" />
          <h3 className="text-sm font-black">AI কী যোগ করুন (ফ্রি Gemini কী)</h3>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          একটি বক্সে একটি কী দিয়ে <b>সেভ</b> দিন — যত ইচ্ছা কী যোগ করা যাবে। একটি কীর ফ্রি লিমিট
          শেষ হলে বট <b>নিজে থেকেই</b> পরের কী ব্যবহার করবে, ১ ঘণ্টা পর আগের কী আবার চেষ্টা করবে।
        </p>
        <input
          value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza... (Google AI Studio কী)"
          className="w-full rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-xs font-mono"
        />
        <input
          value={label} onChange={(e) => setLabel(e.target.value)} placeholder="নাম/নোট (ঐচ্ছিক) — যেমন: Gmail-1"
          className="w-full rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-xs"
        />
        <button
          onClick={() => add.mutate()} disabled={key.trim().length < 20 || add.isPending}
          className="w-full gradient-cta rounded-xl py-2.5 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {add.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} কী সেভ করুন
        </button>
      </div>

      <div className="glass rounded-2xl p-4">
        <p className="text-[11px] font-black mb-2">
          মোট কী: {keys.length} · এখন ব্যবহারযোগ্য: <span className="text-emerald">{live}</span>
          {data?.provider === "lovable" && <span className="text-amber-500"> · এখন পেইড গেটওয়ে চলছে</span>}
        </p>
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : keys.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">এখনো কোনো কী যোগ করা হয়নি।</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{k.label || "কী"} <span className="font-mono text-[10px] text-muted-foreground">{k.masked}</span></p>
                    <p className="text-[10px] text-muted-foreground">
                      ব্যবহার: {k.calls} বার
                      {k.onCooldown ? " · ⏳ লিমিট শেষ (১ ঘণ্টা বিশ্রামে)" : k.active ? " · ✅ চালু" : " · ⛔ বন্ধ"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggle.mutate({ id: k.id, active: !k.active })}
                      className="rounded-lg border border-border px-2 py-1 text-[10px] font-black">
                      {k.active ? "বন্ধ" : "চালু"}
                    </button>
                    <button onClick={() => del.mutate(k.id)} className="rounded-lg border border-destructive/40 text-destructive px-2 py-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {k.lastError && !/ভয়েস|voice|tts|stt/i.test(k.lastError) && (
                  <p className="text-[10px] text-destructive mt-1 truncate">{k.lastError}</p>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 rounded-xl bg-cyan/10 border border-cyan/30 p-3">
          <p className="text-[11px] font-black mb-1">১টি ফ্রি কী দিয়ে কতগুলো উত্তর যায়?</p>
          <p className="text-[10.5px] text-muted-foreground leading-snug">
            গুগলের ফ্রি লিমিট অনুযায়ী প্রতি কীতে সাধারণত <b>দিনে প্রায় ২০০–২৫০টি উত্তর</b> (মিনিটে ১০–১৫টি)।
            ছবি/স্ক্রিনশট পড়াতে একটু বেশি খরচ হয়, তাই ছবিসহ প্রশ্ন হলে দিনে কম যাবে। লিমিট প্রতিদিন
            আবার শূন্য থেকে শুরু হয়। একই প্রশ্ন আগে একবার উত্তর দেওয়া থাকলে সেটি <b>মেমোরি থেকে</b> যায় —
            কোনো কী খরচ হয় না। তাই ৩–৪টি কী দিলে দিনে <b>৮০০–১০০০+</b> উত্তর নিশ্চিন্তে হয়ে যায়।
          </p>
        </div>
      </div>
    </div>
  );
}
