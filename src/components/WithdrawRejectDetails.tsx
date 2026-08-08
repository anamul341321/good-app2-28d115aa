import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMyRejectProofUrl } from "@/lib/withdraw.functions";
import { useLang } from "@/lib/i18n";
import { X } from "lucide-react";

/** Rejection reason + optional admin screenshot for the user's own withdrawal. */
export function WithdrawRejectDetails({ w }: { w: any }) {
  const { t } = useLang();
  const [zoom, setZoom] = useState(false);
  const hasProof = !!w.reject_proof_path;

  const proofQ = useQuery({
    queryKey: ["reject-proof", w.id],
    queryFn: () => getMyRejectProofUrl({ data: { id: w.id } }),
    enabled: hasProof,
    staleTime: 10 * 60 * 1000,
  });
  const url = (proofQ.data as any)?.url ?? null;

  return (
    <div className="mt-2 rounded-lg bg-rose/10 border border-rose/30 p-2 text-[11px] text-rose leading-snug space-y-1.5">
      <p className="font-black text-[9px] uppercase tracking-widest">
        {t("বাতিলের কারণ", "Reason for rejection")}
      </p>
      {w.reject_reason ? (
        <p className="whitespace-pre-wrap" translate="no">{w.reject_reason}</p>
      ) : (
        <p className="opacity-80">{t("কারণ লেখা হয়নি — সাপোর্টে যোগাযোগ করুন", "No reason given — contact support")}</p>
      )}

      {w.admin_note && (
        <p className="text-[10px] text-muted-foreground italic" translate="no">{w.admin_note}</p>
      )}

      {w.fee_refunded && (
        <p className="text-[10px] font-bold text-emerald">
          ✅ {t("ফি সহ পুরো টাকা ব্যালেন্সে ফেরত দেওয়া হয়েছে", "Full amount incl. fee refunded to balance")}
        </p>
      )}

      {hasProof && (
        <div>
          {url ? (
            <button type="button" onClick={() => setZoom(true)} className="block">
              <img
                src={url}
                alt={t("বাতিলের স্ক্রিনশট", "Rejection screenshot")}
                className="mt-1 max-h-40 w-auto rounded-lg border border-rose/40 object-contain"
                loading="lazy"
              />
              <span className="text-[9px] opacity-70">{t("ছবিতে চাপ দিন — বড় করে দেখুন", "Tap image to zoom")}</span>
            </button>
          ) : (
            <p className="text-[10px] opacity-70">{t("স্ক্রিনশট লোড হচ্ছে…", "Loading screenshot…")}</p>
          )}
        </div>
      )}

      {zoom && url && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-3"
          onClick={() => setZoom(false)}
        >
          <button type="button" className="absolute top-4 right-4 text-white" onClick={() => setZoom(false)}>
            <X className="w-6 h-6" />
          </button>
          <img src={url} alt={t("বাতিলের স্ক্রিনশট", "Rejection screenshot")} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
