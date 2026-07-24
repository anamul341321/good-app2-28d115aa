import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { adminListKycProfiles } from "@/lib/recharge.functions";
import { Loader2, Search, User, IdCard, Copy, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/kyc")({ component: AdminKyc });

function AdminKyc() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-kyc-list"], queryFn: () => adminListKycProfiles() });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!q.trim()) return list;
    const s = q.trim().toLowerCase();
    return list.filter((r: any) =>
      (r.display_name ?? "").toLowerCase().includes(s) ||
      (r.phone_number ?? "").includes(s) ||
      (r.nid_number ?? "").includes(s) ||
      String(r.uid_seq ?? "").includes(s));
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">KYC Verified Users</h1>
        <p className="text-sm text-muted-foreground">Total: <span className="mono-num font-black">{data?.length ?? 0}</span></p>
      </div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name / phone / NID / UID"
          className="w-full pl-9 pr-3 py-2.5 bg-surface-2 border border-border rounded-xl outline-none focus:border-cyan" />
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r: any) => <KycCard key={r.id} r={r} />)}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">কেউ পাওয়া যায়নি</p>}
        </div>
      )}
    </div>
  );
}

function KycCard({ r }: { r: any }) {
  const [openImg, setOpenImg] = useState<{ url: string; label: string } | null>(null);
  const copy = (v: string, label: string) => {
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success(`${label} কপি হয়েছে`);
  };
  return (
    <>
      <div className="rounded-2xl overflow-hidden shadow-lg border border-border bg-white">
        <div className="p-4 flex gap-3 text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b)" }}>
          {r.avatar_signed ? (
            <img src={r.avatar_signed} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-lg" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center"><User className="w-8 h-8" /></div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-widest opacity-80 font-black">KYC ✓</p>
            <p className="text-base font-black truncate drop-shadow">{r.display_name || "—"}</p>
            <button onClick={() => copy(String(r.uid_seq), "UID")}
              className="mt-0.5 inline-flex items-center gap-1 text-[10px] mono-num bg-white/25 px-2 py-0.5 rounded-full">
              UID {r.uid_seq} <Copy className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
        <div className="p-3 space-y-1.5 text-[12px]">
          {r.phone_number && (
            <Row icon="📱" onCopy={() => copy(r.phone_number, "ফোন")} value={r.phone_number} />
          )}
          {r.nid_number && (
            <Row icon={<IdCard className="w-3.5 h-3.5" />} onCopy={() => copy(r.nid_number, "NID")} value={r.nid_number} />
          )}
          {r.date_of_birth && <Row icon={<Calendar className="w-3.5 h-3.5" />} value={r.date_of_birth} />}
          {r.father_name && <Row icon="👨" value={`পিতা: ${r.father_name}`} />}
          {r.mother_name && <Row icon="👩" value={`মাতা: ${r.mother_name}`} />}
          {(r.full_address || r.village_area) && (
            <Row icon={<MapPin className="w-3.5 h-3.5" />} value={r.full_address || [r.village_area, r.post_office, r.thana_upazila, r.district].filter(Boolean).join(", ")} />
          )}
          <div className="grid grid-cols-3 gap-1.5 pt-2">
            {r.kyc_photo_signed && <ImgThumb url={r.kyc_photo_signed} label="Selfie" onClick={() => setOpenImg({ url: r.kyc_photo_signed, label: "Selfie" })} />}
            {r.kyc_nid_front_signed && <ImgThumb url={r.kyc_nid_front_signed} label="NID Front" onClick={() => setOpenImg({ url: r.kyc_nid_front_signed, label: "NID Front" })} />}
            {r.kyc_nid_back_signed && <ImgThumb url={r.kyc_nid_back_signed} label="NID Back" onClick={() => setOpenImg({ url: r.kyc_nid_back_signed, label: "NID Back" })} />}
          </div>
          <p className="text-[10px] text-muted-foreground pt-1">Verified: {r.kyc_verified_at ? new Date(r.kyc_verified_at).toLocaleString() : "—"}</p>
        </div>
      </div>
      {openImg && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setOpenImg(null)}>
          <div className="max-w-lg w-full">
            <img src={openImg.url} className="w-full rounded-xl" alt={openImg.label} />
            <p className="text-white text-center mt-2 font-black">{openImg.label}</p>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ icon, value, onCopy }: { icon: React.ReactNode; value: string; onCopy?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="mono-num flex-1 truncate">{value}</span>
      {onCopy && <button onClick={onCopy} className="text-cyan"><Copy className="w-3 h-3" /></button>}
    </div>
  );
}

function ImgThumb({ url, label, onClick }: { url: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg overflow-hidden border border-border relative btn-press">
      <img src={url} className="w-full h-16 object-cover" alt={label} />
      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] py-0.5 font-bold">{label}</span>
    </button>
  );
}
