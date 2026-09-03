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

      {/* Monthly Mining Info */}
{!isLiteBuild() && (
      {!isLiteBuild() && <div className="glass rounded-2xl p-4 border border-emerald/20 bg-emerald/5 no-print">}
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
)}
      </div>
      <PasswordSelfChange />



      <div className={`grid ${isLiteBuild() ? "grid-cols-2" : "grid-cols-3"} gap-2 no-print`}>
        <TabBtn active={tab === "card"} onClick={() => setTab("card")} icon={<IdCard className="w-4 h-4" />} label="কার্ড" voice="profile.card" />
        {!isLiteBuild() && (
          <TabBtn active={tab === "withdraw"} onClick={() => setTab("withdraw")} icon={<History className="w-4 h-4" />} label="উইথড্র" voice="profile.history" />
        )}
         {!isLiteBuild() && <TabBtn active={tab === "claim"} onClick={() => setTab("claim")} icon={<Sparkles className="w-4 h-4" />} label="ক্লেইম" voice="profile.history" />
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
      {!isLiteBuild() && tab === "claim" && <HistoryList empty="এখনো কোনো ক্লেইম বা বোনাস সংশোধন নেই" items={(data.claims ?? []).map((c: any) => ({ id: c.id, amount: Number(c.amount), date: c.created_at, status: (c.kind ?? "mining") === "mining" ? "claim" : "bonus", meta: (c.kind ?? "mining") === "mining" ? (c.note ?? "মাইনিং ক্লেইম") : `প্রোমো বোনাস · ${c.note ?? "সংশোধন"}` }))} />}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block min-w-0">
      <span className="text-[11px] font-black text-navy">{label}</span>
      <input value={value} type={type} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30" />
    </label>
  );
}

function IdCardFace({ side, p, uid, cardUrl, avatarUrl, details, stats }: { side: "front" | "back"; p: any; uid: string; cardUrl: string; avatarUrl: string | null; details: DetailsForm; stats: any }) {
  const formattedUid = uid.match(/.{1,4}/g)?.join(" ");
  return (
    <article className="good-id-card" data-side={side}>
      <div className="good-id-watermark">GOOD-APP OFFICIAL</div>
      <div className="good-id-pattern" />
      {side === "front" ? (
        <>
          <header className="good-id-header">
            <div>
              <p className="good-id-brand">GOOD-APP · OFFICIAL</p>
              <p className="good-id-subtitle">সদস্য পরিচয়পত্র</p>
            </div>
            <div className="good-id-chip">FRONT</div>
          </header>
          <div className="good-id-front-main">
            <div className="good-id-photo">
              {avatarUrl ? <img src={avatarUrl} alt="প্রোফাইল ছবি" crossOrigin="anonymous" /> : <User className="w-12 h-12" />}
              {(p as any).kyc_verified && (
                <span style={{ position: "absolute", top: -6, right: -6, background: "#fff", borderRadius: 999, padding: 2, boxShadow: "0 2px 6px rgba(0,0,0,.2)" }}>
                  <BadgeCheck style={{ width: 22, height: 22, color: "#1d9bf0" }} />
                </span>
              )}
            </div>
            <div className="good-id-info">
              <SmallRow k="নাম" v={p.display_name ?? "-"} />
              <SmallRow k="মোবাইল" v={p.phone_number ?? "-"} mono />
              <SmallRow k="UID" v={formattedUid ?? uid} mono strong />
              <SmallRow k="NID" v={details.nid_number || "-"} mono />
              <SmallRow k="যোগদান" v={new Date(p.created_at).toLocaleDateString("bn-BD")} />
              {(p as any).kyc_verified && <SmallRow k="স্ট্যাটাস" v="✔ KYC ভেরিফাইড" />}
            </div>
          </div>
          <footer className="good-id-footer">
            <span>Card No.</span><b>{formattedUid}</b>
          </footer>
        </>
      ) : (
        <>
          <header className="good-id-header">
            <div>
              <p className="good-id-brand">GOOD-APP · BACK SIDE</p>
              <p className="good-id-subtitle">QR, পরিচয় ও ঠিকানা</p>
            </div>
            <div className="good-id-qr"><QrCode value={cardUrl} size={92} /></div>
          </header>
          <div className="good-id-address">
            <SmallRow k="পিতার নাম" v={details.father_name || "-"} />
            <SmallRow k="মাতার নাম" v={details.mother_name || "-"} />
            <SmallRow k="জন্মতারিখ" v={details.date_of_birth ? new Date(details.date_of_birth).toLocaleDateString("bn-BD") : "-"} />
            <SmallRow k="গ্রাম/এলাকা" v={details.village_area || "-"} />
            <SmallRow k="ডাকঘর" v={details.post_office || "-"} />
            <SmallRow k="থানা/উপজেলা" v={details.thana_upazila || "-"} />
            <SmallRow k="জেলা" v={details.district || "-"} />
          </div>
          <div className="good-id-full-address">
            <span>সম্পূর্ণ ঠিকানা</span>
            <p>{details.full_address || "ঠিকানা এখনো দেওয়া হয়নি"}</p>
          </div>
          <footer className="good-id-footer"><span>QR স্ক্যান করলে পাবলিক কার্ড খুলবে</span><b>{uid}</b></footer>
        </>
      )}
    </article>
  );
}

function SmallRow({ k, v, mono, strong }: { k: string; v: string; mono?: boolean; strong?: boolean }) {
  return <p className="good-id-row"><span>{k}</span><b className={`${mono ? "mono-num" : ""} ${strong ? "good-id-uid" : ""}`}>{v}</b></p>;
}

function CardStat({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><b className="mono-num">{value}</b></div>;
}

function TabBtn({ active, onClick, icon, label, voice }: any) {
  return <button onClick={onClick} data-voice={voice} className={`btn-press py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-all ${active ? "gradient-cta border-transparent glow-violet" : "bg-surface-2 border-border text-muted-foreground"}`}>{icon} {label}</button>;
}

function HistoryList({ items, empty }: { items: any[]; empty: string }) {
  if (items.length === 0) return <div className="glass rounded-2xl p-10 text-center"><History className="w-8 h-8 text-muted-foreground mx-auto mb-2 float-anim" /><p className="text-xs text-muted-foreground">{empty}</p></div>;
  return <div className="space-y-2">{items.map((it, idx) => <div key={it.id} className="glass rounded-xl p-3 flex items-center justify-between pop-in" style={{ animationDelay: `${idx * 40}ms` }}><div className="min-w-0"><p className="mono-num font-black text-base text-gold">{it.amount.toFixed(4)} ৳</p><p className="text-[10px] text-muted-foreground truncate">{new Date(it.date).toLocaleString("bn-BD")} · {it.meta}</p></div><StatusPill status={it.status} /></div>)}</div>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    paid: { cls: "bg-emerald/15 text-emerald border-emerald/30", icon: CheckCircle2, label: "PAID" },
    pending: { cls: "bg-amber/15 text-amber border-amber/30", icon: Clock, label: "PENDING" },
    rejected: { cls: "bg-rose/15 text-rose border-rose/30", icon: XCircle, label: "REJECTED" },
    claim: { cls: "bg-violet/15 text-violet border-violet/30", icon: Sparkles, label: "CLAIM" },
  };
  const s = map[status] ?? map.pending;
  const Icon = s.icon;
  return <span className={`text-[10px] font-black px-2 py-1 rounded-full border flex items-center gap-1 ${s.cls}`}><Icon className="w-3 h-3" /> {s.label}</span>;
}

async function renderCardCanvas({ p, uid, cardUrl, avatarUrl, details, stats }: { p: any; uid: string; cardUrl: string; avatarUrl: string | null; details: DetailsForm; stats: any }) {
  const width = 1080;
  const faceH = 680;
  const gap = 48;
  const height = faceH * 2 + gap;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f8fbff";
  ctx.fillRect(0, 0, width, height);
  const qr = await import("qrcode");
  const QRCode = (qr as any).default ?? qr;
  const qrUrl = await QRCode.toDataURL(cardUrl, { width: 220, margin: 1, color: { dark: "#111827", light: "#ffffff" } });
  const qrImg = await loadImage(qrUrl);
  const avatarImg = avatarUrl ? await loadImageFromUrl(avatarUrl).catch(() => null) : null;
  drawCanvasFace(ctx, 40, 20, width - 80, faceH, "front", { p, uid, details, stats, qrImg, avatarImg });
  drawCanvasFace(ctx, 40, faceH + gap, width - 80, faceH, "back", { p, uid, details, stats, qrImg, avatarImg });
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("ছবি তৈরি হয়নি")), "image/png", 0.95));
}

function drawCanvasFace(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, side: "front" | "back", data: any) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#fff7ed"); g.addColorStop(0.35, "#ffe4f0"); g.addColorStop(0.7, "#dff9ff"); g.addColorStop(1, "#e8fff4");
  roundRect(ctx, x, y, w, h, 44, g);
  ctx.strokeStyle = "#ef476f"; ctx.lineWidth = 5; roundStroke(ctx, x + 2, y + 2, w - 4, h - 4, 42);
  ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = "#111827"; ctx.font = "900 74px sans-serif"; ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.25); ctx.textAlign = "center"; ctx.fillText("GOOD-APP OFFICIAL", 0, 0); ctx.restore();
  ctx.fillStyle = "#111827"; ctx.font = "900 26px sans-serif"; ctx.fillText(side === "front" ? "GOOD-APP · OFFICIAL" : "GOOD-APP · BACK SIDE", x + 46, y + 58);
  ctx.fillStyle = "#ef476f"; ctx.font = "800 24px sans-serif"; ctx.fillText(side === "front" ? "সদস্য পরিচয়পত্র" : "QR, পরিচয় ও ঠিকানা", x + 46, y + 92);
  if (side === "front") {
    if (data.avatarImg) drawImageRounded(ctx, data.avatarImg, x + 54, y + 150, 230, 270, 26); else { ctx.fillStyle = "#e5e7eb"; roundRect(ctx, x + 54, y + 150, 230, 270, 26, "#e5e7eb"); }
    const rows = [["নাম", data.p.display_name ?? "-"], ["মোবাইল", data.p.phone_number ?? "-"], ["UID", data.uid.match(/.{1,4}/g)?.join(" ") ?? data.uid], ["NID", data.details.nid_number || "-"], ["যোগদান", new Date(data.p.created_at).toLocaleDateString("bn-BD")]];
    drawRows(ctx, x + 330, y + 170, rows, 36);
    drawStats(ctx, x + 54, y + 470, w - 108, [["সাক্ষী", `${data.stats.doneCount}/${data.stats.taskCount}`], ["ব্যালান্স", `${data.stats.balance.toFixed(2)}৳`], ["উইথড্র", `${data.stats.withdrawCount}x`]]);
    ctx.fillStyle = "#111827"; ctx.font = "900 34px monospace"; ctx.fillText(`CARD NO.  ${data.uid.match(/.{1,4}/g)?.join(" ")}`, x + 54, y + 620);
  } else {
    ctx.drawImage(data.qrImg, x + w - 250, y + 42, 190, 190);
    const rows = [["পিতার নাম", data.details.father_name || "-"], ["মাতার নাম", data.details.mother_name || "-"], ["জন্মতারিখ", data.details.date_of_birth ? new Date(data.details.date_of_birth).toLocaleDateString("bn-BD") : "-"], ["গ্রাম/এলাকা", data.details.village_area || "-"], ["ডাকঘর", data.details.post_office || "-"], ["থানা/উপজেলা", data.details.thana_upazila || "-"], ["জেলা", data.details.district || "-"]];
    drawRows(ctx, x + 54, y + 150, rows, 36, 260);
    ctx.fillStyle = "#ef476f"; ctx.font = "900 25px sans-serif"; ctx.fillText("সম্পূর্ণ ঠিকানা", x + 54, y + 470);
    ctx.fillStyle = "#111827"; ctx.font = "800 26px sans-serif"; wrapText(ctx, data.details.full_address || "ঠিকানা এখনো দেওয়া হয়নি", x + 54, y + 510, w - 108, 34);
    ctx.fillStyle = "#111827"; ctx.font = "900 24px monospace"; ctx.fillText(data.uid, x + 54, y + 625);
  }
}

function drawRows(ctx: CanvasRenderingContext2D, x: number, y: number, rows: string[][], line = 36, keyW = 170) {
  rows.forEach(([k, v], i) => { ctx.fillStyle = "#64748b"; ctx.font = "800 23px sans-serif"; ctx.fillText(k, x, y + i * line); ctx.fillStyle = "#111827"; ctx.font = "900 28px sans-serif"; ctx.fillText(v, x + keyW, y + i * line); });
}
function drawStats(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, stats: string[][]) { const sw = (w - 24) / 3; stats.forEach(([k, v], i) => { roundRect(ctx, x + i * (sw + 12), y, sw, 86, 24, "rgba(255,255,255,0.72)"); ctx.fillStyle = "#64748b"; ctx.font = "800 21px sans-serif"; ctx.textAlign = "center"; ctx.fillText(k, x + i * (sw + 12) + sw / 2, y + 30); ctx.fillStyle = "#f59e0b"; ctx.font = "900 32px monospace"; ctx.fillText(v, x + i * (sw + 12) + sw / 2, y + 66); ctx.textAlign = "start"; }); }
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) { const words = text.split(" "); let line = ""; for (const word of words) { const test = line + word + " "; if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line, x, y); line = word + " "; y += lineHeight; } else line = test; } ctx.fillText(line, x, y); }
function addRoundPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) { ctx.beginPath(); addRoundPath(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
function roundStroke(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); addRoundPath(ctx, x, y, w, h, r); ctx.stroke(); }
function drawImageRounded(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) { ctx.save(); ctx.beginPath(); addRoundPath(ctx, x, y, w, h, r); ctx.clip(); ctx.drawImage(img, x, y, w, h); ctx.restore(); }
function loadImage(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; }); }
async function loadImageFromUrl(src: string) { const res = await fetch(src); const blob = await res.blob(); const url = URL.createObjectURL(blob); try { return await loadImage(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); } }
function PasswordSelfChange() {
  const [open, setOpen] = useState(false);
  const [nx, setNx] = useState("");
  const [nx2, setNx2] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "code">("form");
  const [dest, setDest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    if (nx.length < 6) return toast.error("কমপক্ষে ৬ অক্ষর দিন");
    if (nx !== nx2) return toast.error("পাসওয়ার্ড মিলছে না");
    setBusy(true);
    try {
      const { requestPasswordChangeOtp, changePasswordWithOtp } = await import("@/lib/password-change.functions");
      const res: any = await requestPasswordChangeOtp();
      if (res?.skipOtp) {
        await changePasswordWithOtp({ data: { code: "000000", newPassword: nx } });
        toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে");
        setNx(""); setNx2(""); setCode(""); setStep("form"); setOpen(false);
        return;
      }
      setDest(res?.destination ?? null);
      setStep("code");
      toast.success("Gmail-এ ৬ ডিজিটের কোড পাঠানো হয়েছে");
    } catch (e: any) { toast.error(e?.message ?? "কোড পাঠানো যায়নি"); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const { changePasswordWithOtp } = await import("@/lib/password-change.functions");
      await changePasswordWithOtp({ data: { code, newPassword: nx } });
      toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে");
      setNx(""); setNx2(""); setCode(""); setStep("form"); setOpen(false);
    } catch (e: any) { toast.error(e?.message ?? "পরিবর্তন হয়নি"); }
    finally { setBusy(false); }
  };

  return (
    <div className="glass rounded-2xl p-4 no-print">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 w-full text-left">
        <div className="w-9 h-9 rounded-lg bg-violet/15 flex items-center justify-center text-violet">🔑</div>
        <div className="flex-1">
          <p className="text-sm font-black">পাসওয়ার্ড পরিবর্তন</p>
          <p className="text-[11px] text-muted-foreground">Gmail-এ কোড যাবে, কোড দিলেই বদলাবে</p>
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && step === "form" && (
        <div className="mt-3 space-y-2">
          <input type="password" value={nx} onChange={e => setNx(e.target.value)} placeholder="নতুন পাসওয়ার্ড"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm outline-none focus:border-violet" />
          <input type="password" value={nx2} onChange={e => setNx2(e.target.value)} placeholder="আবার লিখুন"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm outline-none focus:border-violet" />
          <button onClick={sendCode} disabled={busy}
            className="w-full gradient-cta rounded-lg py-2 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Gmail-এ কোড পাঠান
          </button>
        </div>
      )}
      {open && step === "code" && (
        <div className="mt-3 space-y-2">
          <p className="text-[11.5px] font-bold text-muted-foreground">কোড পাঠানো হয়েছে: <b translate="no">{dest}</b></p>
          <input inputMode="numeric" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="৬ ডিজিটের কোড"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-center tracking-[8px] font-black mono-num outline-none focus:border-violet" />
          <button onClick={submit} disabled={busy || code.length !== 6}
            className="w-full gradient-cta rounded-lg py-2 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            সেভ করুন
          </button>
          <button onClick={() => { setStep("form"); setCode(""); }}
            className="w-full py-1 text-[11px] font-black text-cyan underline underline-offset-4">পিছনে</button>
        </div>
      )}
    </div>
  );
}

