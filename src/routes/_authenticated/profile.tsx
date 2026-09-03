import { createFileRoute, Navigate } from "@tanstack/react-router";
import { isLiteBuild } from "@/lib/lite-build";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { getProfileHistory, updateProfileDetails, uploadAvatar } from "@/lib/profile.functions";
import { computeLiveBalance } from "@/lib/mining";
import { Camera, Download, Loader2, User, IdCard, History, Sparkles, CheckCircle2, XCircle, Clock, Printer, MapPin, Save, BadgeCheck, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageVoice } from "@/components/PageVoice";
import { QrCode } from "@/components/QrCode";
import { useAuth } from "@/hooks/useAuth";
import { PageBackHeader } from "@/components/PageBackHeader";

export const Route = createFileRoute("/_authenticated/profile")({ component: OwnSocialProfileRedirect });

function OwnSocialProfileRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Navigate to="/auth" />;
  }
  return <Navigate to="/user/$userId" params={{ userId: user.id }} />;
}

type DetailsForm = {
  nid_number: string;
  date_of_birth: string;
  father_name: string;
  mother_name: string;
  village_area: string;
  post_office: string;
  thana_upazila: string;
  district: string;
  full_address: string;
};

const emptyDetails: DetailsForm = {
  nid_number: "",
  date_of_birth: "",
  father_name: "",
  mother_name: "",
  village_area: "",
  post_office: "",
  thana_upazila: "",
  district: "",
  full_address: "",
};

function ProfilePage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["profile-history"], queryFn: () => getProfileHistory(), refetchInterval: 30_000,
  });
  const [tab, setTab] = useState<"card" | "withdraw" | "claim">("card");
  const [now, setNow] = useState(Date.now());
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [details, setDetails] = useState<DetailsForm>(emptyDetails);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    const p: any = data?.profile;
    if (!p) return;
    setDetails({
      nid_number: p.nid_number ?? "",
      date_of_birth: p.date_of_birth ?? "",
      father_name: p.father_name ?? "",
      mother_name: p.mother_name ?? "",
      village_area: p.village_area ?? "",
      post_office: p.post_office ?? "",
      thana_upazila: p.thana_upazila ?? "",
      district: p.district ?? "",
      full_address: p.full_address ?? "",
    });
  }, [data?.profile]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("শুধু ছবি আপলোড করা যাবে");
      const dataUrl: string = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = () => rej(new Error("ফাইল পড়া যায়নি"));
        reader.readAsDataURL(file);
      });
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("ছবি লোড করা যায়নি"));
        img.src = dataUrl;
      });
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const jpeg = canvas.toDataURL("image/jpeg", 0.85);
      return uploadAvatar({ data: { base64: jpeg.split(",")[1], contentType: "image/jpeg" } });
    },
    onSuccess: () => { toast.success("প্রোফাইল ছবি আপডেট হয়েছে ✨"); refetch(); },
    onError: (e: any) => toast.error(e.message ?? "আপলোড ব্যর্থ হয়েছে"),
  });

  const saveDetails = useMutation({
    mutationFn: () => updateProfileDetails({ data: details }),
    onSuccess: () => { toast.success("পরিচয় ও ঠিকানা সেভ হয়েছে"); refetch(); },
    onError: (e: any) => toast.error(e.message ?? "সেভ হয়নি"),
  });

  if (isLoading || !data) {
    return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-violet" /></div>;
  }

  const p: any = data.profile!;
  const uid = String(p.uid_seq ?? p.id);
  const cardUrl = typeof window !== "undefined" ? `${window.location.origin}/card/${uid}` : `/card/${uid}`;
  const mining = data.mining;
  const balance = mining ? computeLiveBalance({
    accrued: Number(mining.accrued_amount), withdrawn: Number(mining.withdrawn_amount),
    isActive: !!mining.is_active, lastCreditedAt: mining.last_credited_at, now,
  }) : 0;
  const doneCount = (data.tasks ?? []).filter((t: any) => t.status === "done" && (t.whitelist_ok ?? true)).length;
  const stats = { doneCount, taskCount: (data.tasks ?? []).length, balance, withdrawCount: (data.withdrawals ?? []).length };

  const printCard = () => window.print();

  const downloadCard = async () => {
    setDownloading(true);
    try {
      const blob = await renderCardCanvas({ p, uid, cardUrl, avatarUrl: data.avatar_signed, details, stats });
      const link = document.createElement("a");
      link.download = `good-app-card-${uid}.png`;
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      toast.success("কার্ড গ্যালারিতে সেভ করার জন্য ডাউনলোড হয়েছে ✨");
    } catch (e: any) {
      toast.error(e?.message ?? "ডাউনলোড ব্যর্থ হয়েছে");
    } finally { setDownloading(false); }
  };

  return (
    <div className="space-y-5 px-4 pt-2 pop-in profile-print-root">
      <PageBackHeader title="আমার প্রোফাইল" />
      <PageVoice pageId="profile" steps={["profile.intro","profile.avatar","profile.uid","profile.card","profile.qr","profile.download"]} />

      <div className="text-center no-print">
        <h1 className="text-2xl font-black flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-gold bounce-soft" /> আমার প্রোফাইল
        </h1>
        <p className="text-xs text-muted-foreground mt-1">সম্পূর্ণ তথ্য, কার্ড ও হিস্ট্রি</p>
      </div>

      {doneCount === 0 && (
        <Link
          to="/task/$slot"
          params={{ slot: "1" }}
          className="no-print block rounded-2xl border-2 border-rose bg-rose/10 p-4 text-center animate-pulse"
        >
          <p className="text-sm font-black text-rose">🔴 ফেস ভেরিফিকেশন বাকি আছে</p>
          <p className="mt-1 text-[11px] font-bold text-rose/80">
            এখনই ফেস ভেরিফিকেশন করুন — ছবি ক্যামেরা দিয়ে তুলতে পারবেন অথবা গ্যালারি থেকেও দিতে
            পারবেন। ভেরিফিকেশনের মেয়াদ শেষ হলে আবার করতে বলা হবে।
          </p>
          <span className="mt-2 inline-block rounded-xl bg-rose px-4 py-1.5 text-[11px] font-black text-white">
            ফেস ভেরিফিকেশন করুন →
          </span>
        </Link>
      )}

      <div className="glass rounded-2xl p-5 flex flex-col items-center gap-3 no-print">
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl overflow-hidden shimmer-border bg-surface-2 flex items-center justify-center">
            {data.avatar_signed ? <img src={data.avatar_signed} className="w-full h-full object-cover" alt="avatar" /> : <User className="w-10 h-10 text-muted-foreground" />}
          </div>
          {(p as any).kyc_verified && (
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center" title="KYC ভেরিফাইড">
              <BadgeCheck className="w-7 h-7" style={{ color: "#1d9bf0" }} />
            </div>
          )}
          <label data-voice="profile.avatar" className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full gradient-cta flex items-center justify-center cursor-pointer btn-press glow-violet">
            {upload.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
          </label>
        </div>
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(uid); toast.success("UID কপি হয়েছে"); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/15 border border-gold/40 text-gold font-black text-[11px] btn-press"
          title="UID কপি করুন"
        >
          <IdCard className="w-3.5 h-3.5" />
          <span className="mono-num tracking-widest">UID: {uid}</span>
          <span className="text-[10px]">📋</span>
        </button>
        <div className="text-center min-w-0 w-full">
          <p className="text-lg font-black truncate flex items-center justify-center gap-1.5">
            {p.display_name ?? "ইউজার"}
            {(p as any).kyc_verified && <BadgeCheck className="w-4 h-4" style={{ color: "#1d9bf0" }} />}
          </p>
          <p className="text-xs text-muted-foreground mono-num">{p.phone_number ?? "-"}</p>
          {(p as any).kyc_verified ? (
            <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 text-[10px] font-black">
              <BadgeCheck className="w-3 h-3" /> Verified
            </span>
          ) : (
            <Link to="/kyc" className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-white text-[10px] font-black btn-press"
                  style={{ background: "linear-gradient(120deg,#f43f5e,#f59e0b)" }}>
              <ShieldCheck className="w-3 h-3" /> KYC করুন
            </Link>
          )}
        </div>
      </div>

      {!isLiteBuild() && (
      <div className="glass rounded-2xl p-4 border border-emerald/20 bg-emerald/5 no-print">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald/20 flex items-center justify-center text-emerald">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-black text-emerald uppercase tracking-wider">মাসিক মাইনিং রেট</p>
              <p className="text-lg font-black text-navy">
                ৳{((data.mining as any)?.monthly_rate ?? 500)} / মাস
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-muted-foreground">স্ট্যাটাস</p>
            <p className={`text-xs font-black ${mining?.is_active ? "text-emerald" : "text-rose"}`}>
              {mining?.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
            </p>
          </div>
        </div>
      </div>
      )}

      <PasswordSelfChange />

      <div className={`grid ${isLiteBuild() ? "grid-cols-2" : "grid-cols-3"} gap-2 no-print`}>
        <TabBtn active={tab === "card"} onClick={() => setTab("card")} icon={<IdCard className="w-4 h-4" />} label="কার্ড" voice="profile.card" />
        {!isLiteBuild() && (
          <TabBtn active={tab === "withdraw"} onClick={() => setTab("withdraw")} icon={<History className="w-4 h-4" />} label="উইথড্র" voice="profile.history" />
        )}
        {!isLiteBuild() && (
          <TabBtn active={tab === "claim"} onClick={() => setTab("claim")} icon={<Sparkles className="w-4 h-4" />} label="ক্লেইম" voice="profile.history" />
        )}
      </div>

      {tab === "card" && (
        <div className="space-y-4" data-voice="profile.card">
          <section className="glass rounded-3xl p-4 space-y-3 no-print">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose" />
              <div>
                <h2 className="text-lg font-black">পরিচয় ও ঠিকানা</h2>
                <p className="text-[11px] text-muted-foreground">NID কার্ডের মতো কার্ডের পিছনে এই তথ্য দেখাবে</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="NID নম্বর" value={details.nid_number} onChange={(v) => setDetails({ ...details, nid_number: v })} />
              <Field label="জন্মতারিখ" type="date" value={details.date_of_birth} onChange={(v) => setDetails({ ...details, date_of_birth: v })} />
              <Field label="পিতার নাম" value={details.father_name} onChange={(v) => setDetails({ ...details, father_name: v })} />
              <Field label="মাতার নাম" value={details.mother_name} onChange={(v) => setDetails({ ...details, mother_name: v })} />
              <Field label="গ্রাম / এলাকা" value={details.village_area} onChange={(v) => setDetails({ ...details, village_area: v })} />
              <Field label="ডাকঘর" value={details.post_office} onChange={(v) => setDetails({ ...details, post_office: v })} />
              <Field label="থানা / উপজেলা" value={details.thana_upazila} onChange={(v) => setDetails({ ...details, thana_upazila: v })} />
              <Field label="জেলা" value={details.district} onChange={(v) => setDetails({ ...details, district: v })} />
            </div>
            <label className="block">
              <span className="text-[11px] font-black text-navy">সম্পূর্ণ ঠিকানা</span>
              <textarea
                value={details.full_address}
                onChange={(e) => setDetails({ ...details, full_address: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="বাড়ি, রাস্তা, গ্রাম, ইউনিয়ন, উপজেলা, জেলা"
              />
            </label>
            <button onClick={() => saveDetails.mutate()} disabled={saveDetails.isPending} className="w-full rounded-2xl gradient-gold py-3 font-black btn-press flex items-center justify-center gap-2">
              {saveDetails.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              ঠিকানা সেভ করুন
            </button>
          </section>

          <div ref={printRef} className="print-card-sheet grid gap-3">
            <IdCardFace side="front" p={p} uid={uid} cardUrl={cardUrl} avatarUrl={data.avatar_signed} details={details} stats={stats} />
            <IdCardFace side="back" p={p} uid={uid} cardUrl={cardUrl} avatarUrl={data.avatar_signed} details={details} stats={stats} />
          </div>

          <div className="grid grid-cols-2 gap-3 no-print">
            <button onClick={downloadCard} disabled={downloading} data-voice="profile.download" className="rounded-2xl py-3.5 font-black text-sm flex items-center justify-center gap-2 btn-press gradient-cta shadow-lg disabled:opacity-60">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              গ্যালারিতে সেভ
            </button>
            <button onClick={printCard} className="rounded-2xl py-3.5 font-black text-sm flex items-center justify-center gap-2 btn-press gradient-emerald shadow-lg">
              <Printer className="w-4 h-4" /> প্রিন্ট করুন
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground no-print">প্রিন্টে দুই পাশ দেখাবে — এক পাশে প্রোফাইল, আরেক পাশে QR ও ঠিকানা</p>
        </div>
      )}

      {tab === "withdraw" && <HistoryList empty="এখনো কোনো উইথড্র হয়নি" items={(data.withdrawals ?? []).map((w: any) => {
        const isAdmin = typeof w.admin_note === "string" && w.admin_note.startsWith("[Admin Payout]");
        const noteClean = isAdmin ? w.admin_note.replace(/^\[Admin Payout\]\s*/, "") : "";
        const badge = isAdmin ? " · 🎁 Admin থেকে" : "";
        const noteBit = noteClean ? ` · ${noteClean}` : "";
        return { id: w.id, amount: Number(w.amount), date: w.created_at, status: w.status, meta: `${w.provider} · ${w.wallet_number}${badge}${noteBit}` };
      })} />}
      {tab === "claim" && <HistoryList empty="এখনো কোনো ক্লেইম বা বোনাস সংশোধন নেই" items={(data.claims ?? []).map((c: any) => ({ id: c.id, amount: Number(c.amount), date: c.created_at, status: (c.kind ?? "mining") === "mining" ? "claim" : "bonus", meta: (c.kind ?? "mining") === "mining" ? (c.note ?? "মাইনিং ক্লেইম") : `প্রোমো বোনাস · ${c.note ?? "সংশোধন"}` }))} />}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black text-navy">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

function TabBtn({ active, onClick, icon, label, voice }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; voice?: string }) {
  return (
    <button onClick={onClick} data-voice={voice} className={`flex flex-col items-center gap-1 rounded-2xl border-2 py-2.5 text-[11px] font-black transition btn-press ${active ? "border-primary bg-primary/10 text-primary shadow-lg" : "border-border bg-surface text-muted-foreground"}`}>
      {icon}
      {label}
    </button>
  );
}

function HistoryList({ items, empty }: { items: any[]; empty: string }) {
  return (
    <div className="space-y-2 no-print">
      {items.length === 0 ? (
        <div className="glass rounded-2xl py-12 text-center">
          <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">{empty}</p>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="glass rounded-2xl p-3.5 flex items-center justify-between gap-3 border border-border">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <StatusBadge status={item.status} />
                <span className="text-[10px] text-muted-foreground mono-num">{new Date(item.date).toLocaleDateString("bn-BD")}</span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{item.meta}</p>
            </div>
            <p className="mono-num text-sm font-black text-navy shrink-0">{Math.floor(item.amount)}৳</p>
          </div>
        ))
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: any = {
    paid: { label: "পেমেন্ট সফল", cls: "bg-emerald/10 text-emerald" },
    pending: { label: "পেন্ডিং", cls: "bg-amber/10 text-amber" },
    rejected: { label: "বাতিল", cls: "bg-rose/10 text-rose" },
    claim: { label: "ক্লেইম", cls: "bg-cyan/10 text-cyan" },
    bonus: { label: "বোনাস", cls: "bg-violet/10 text-violet" },
  };
  const c = cfg[status] || cfg.pending;
  return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${c.cls}`}>{c.label}</span>;
}

function PasswordSelfChange() {
  return null; // logic elsewhere
}

async function renderCardCanvas({ p, uid, cardUrl, avatarUrl, details, stats }: any) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 1200;
  canvas.height = 760;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,1200,760);
  ctx.font = "bold 40px sans-serif";
  ctx.fillStyle = "#000000";
  ctx.fillText("Good-App Identity Card", 50, 80);
  ctx.fillText(`UID: ${uid}`, 50, 150);
  ctx.fillText(`Name: ${p.display_name}`, 50, 220);
  return new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
}

function IdCardFace({ side, p, uid, cardUrl, avatarUrl, details, stats }: any) {
  if (side === "front") return <div className="glass rounded-3xl p-6 border-2 border-primary/20 aspect-[1.6/1] flex flex-col justify-between relative overflow-hidden bg-white shadow-2xl">
    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan to-violet" />
    <div className="flex justify-between items-start">
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-2xl bg-surface-2 border-2 border-border overflow-hidden shrink-0">
          {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" /> : <User className="w-12 h-12 text-muted-foreground m-6" />}
        </div>
        <div>
          <h2 className="text-xl font-black text-navy">{p.display_name}</h2>
          <p className="text-xs font-bold text-muted-foreground mt-0.5 uppercase tracking-wider">Verified User</p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-black mono-num tracking-widest">
            UID: {uid}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="w-12 h-12 rounded-xl gradient-navy flex items-center justify-center text-white mb-2 ml-auto shadow-lg">GA</div>
        <p className="text-[10px] font-black text-navy uppercase tracking-tighter">Good-App Identity</p>
      </div>
    </div>
    <div className="flex justify-between items-end border-t border-border pt-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <div><p className="text-[9px] font-black text-muted-foreground uppercase">Tasks Done</p><p className="text-sm font-black text-navy">{stats.doneCount}</p></div>
        <div><p className="text-[9px] font-black text-muted-foreground uppercase">Status</p><p className="text-sm font-black text-emerald">Active</p></div>
      </div>
      <div className="text-[9px] font-bold text-muted-foreground flex items-center gap-1.5 bg-surface-2 px-2 py-1 rounded-lg border border-border">
        <ShieldCheck className="w-3 h-3 text-emerald" /> Secured by Face Verification
      </div>
    </div>
  </div>;

  return <div className="glass rounded-3xl p-6 border-2 border-primary/20 aspect-[1.6/1] flex gap-6 relative overflow-hidden bg-white shadow-2xl">
    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet to-cyan" />
    <div className="flex-1 space-y-3">
       <div><p className="text-[9px] font-black text-muted-foreground uppercase">Address</p><p className="text-[11px] font-bold text-navy leading-relaxed">{details.full_address || "No address provided"}</p></div>
       <div className="grid grid-cols-2 gap-4">
          <div><p className="text-[9px] font-black text-muted-foreground uppercase">NID</p><p className="text-[11px] font-bold text-navy mono-num">{details.nid_number || "-"}</p></div>
          <div><p className="text-[9px] font-black text-muted-foreground uppercase">DOB</p><p className="text-[11px] font-bold text-navy mono-num">{details.date_of_birth || "-"}</p></div>
       </div>
       <div className="pt-2">
         <p className="text-[8px] leading-relaxed text-muted-foreground font-medium italic">
           This card is a digital identifier for the Good-App platform. It remains the property of the issuer and is used only for internal verification purposes. If found, please return to any Good-App support center.
         </p>
       </div>
    </div>
    <div className="w-32 flex flex-col items-center justify-center gap-2 shrink-0 border-l border-border pl-6">
       <div className="p-2 bg-white rounded-xl shadow-inner border border-border">
         <QrCode value={cardUrl} size={90} />
       </div>
       <p className="text-[8px] font-black text-navy tracking-widest text-center">SCAN TO VERIFY</p>
    </div>
  </div>;
}

export default ProfilePage;
