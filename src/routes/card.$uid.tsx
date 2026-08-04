import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicCardDetails } from "@/lib/profile.functions";
import { QrCode } from "@/components/QrCode";
import { User, Sparkles, BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/card/$uid")({ component: PublicCardPage });

function PublicCardPage() {
  const { uid } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-card", uid],
    queryFn: () => getPublicCardDetails({ data: { uid } }),
    retry: false,
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">লোড হচ্ছে…</div>;
  if (error || !data) return (
    <div className="p-8 text-center space-y-3">
      <p className="text-sm text-destructive font-bold">কার্ড খুঁজে পাওয়া যায়নি</p>
      <Link to="/auth" className="text-xs underline">হোমে ফিরে যান</Link>
    </div>
  );

  const p = data.profile;
  const uidCompact = String((p as any).uid_seq ?? p.id);
  const cardUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="min-h-screen p-4 flex items-center justify-center"
         style={{ background: "radial-gradient(circle at top left,#ffe4f0,transparent 36%), radial-gradient(circle at top right,#dff9ff,transparent 34%), linear-gradient(135deg,#fff7ed,#f8fafc,#f0fdf4)" }}>
      <div className="w-full max-w-md space-y-4">
        <div className="relative rounded-3xl p-5 text-slate-950 overflow-hidden shadow-2xl border-4 border-rose-300"
          style={{ background: "radial-gradient(circle at 10% 0%,rgba(255,209,102,.75),transparent 30%),radial-gradient(circle at 100% 0%,rgba(6,182,212,.38),transparent 34%),linear-gradient(135deg,#fff7ed 0%,#ffe4f0 35%,#e0f7ff 72%,#eafff4 100%)" }}>
          <div className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 14px)" }} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ transform: "rotate(-18deg)", color: "rgba(15,23,42,.055)", fontSize: 58, fontWeight: 1000, letterSpacing: ".08em", whiteSpace: "nowrap" }}>GOOD-APP OFFICIAL</div>
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-950">good-app · Official</p>
              <p className="text-[11px] mt-0.5 font-black text-rose-600">সদস্য পরিচয়পত্র (পাবলিক)</p>
            </div>
            <div className="rounded-xl bg-white p-1.5 shadow-lg border border-white">
              <QrCode value={cardUrl} size={64} />
            </div>
          </div>

          <div className="relative mt-4 flex gap-3">
            <div className="relative w-24 h-28 rounded-xl overflow-hidden border-4 border-white bg-white/70 flex items-center justify-center shrink-0 shadow-lg text-slate-500">
              {data.avatar_signed
                ? <img src={data.avatar_signed} className="w-full h-full object-cover" alt="" />
                : <User className="w-10 h-10" />}
              {(p as any).kyc_verified && (
                <span className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 shadow-lg">
                  <BadgeCheck className="w-6 h-6" style={{ color: "#1d9bf0" }} />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5 text-[12px] font-black text-slate-950">
              <p className="flex items-center gap-1">
                <span className="text-slate-500">নাম:</span> {p.display_name ?? "-"}
                {(p as any).kyc_verified && <BadgeCheck className="w-3.5 h-3.5" style={{ color: "#1d9bf0" }} />}
              </p>
              <p><span className="text-slate-500">রেফার:</span> {p.referral_code}</p>
              <p><span className="text-slate-500">যোগদান:</span> {new Date(p.created_at).toLocaleDateString("bn-BD")}</p>
              <p className="mono-num tracking-widest text-[11px] pt-1 text-rose-700">
                 UID {uidCompact}
              </p>
              {(p as any).kyc_verified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-black">
                  <BadgeCheck className="w-3 h-3" /> KYC Verified
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-center text-slate-600 text-[11px] font-bold flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3" /> good-app · সমাজের সুবিধাবঞ্চিতদের পাশে
        </div>
      </div>
    </div>
  );
}
