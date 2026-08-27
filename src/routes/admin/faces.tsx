import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminListFaces, adminResetTask, adminFreshWallets, adminOnchainScanBatch, adminFaceSignupKeys } from "@/lib/admin.functions";
import { Copy, Loader2, RefreshCw, X, Radar } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/admin/faces")({ component: AdminFaces });

function OnchainAudit() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["fresh-wallets"], queryFn: () => adminFreshWallets() });
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const copyKeys = async (keys: string[] | undefined, label: string) => {
    if (!keys || keys.length === 0) return toast.error(`${label} — কোনো key নেই`);
    await navigator.clipboard.writeText(keys.join("\n"));
    toast.success(`${keys.length} টি key কপি হয়েছে (${label})`);
  };

  const runScan = async () => {
    setScanning(true);
    try {
      for (let i = 0; i < 200; i++) {
        const r = await adminOnchainScanBatch({ data: { limit: 60 } });
        setProgress({ done: r.done, total: r.total });
        if (r.remaining === 0) break;
      }
      toast.success("Blockchain scan শেষ");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Scan ব্যর্থ");
    } finally {
      setScanning(false);
    }
  };

  const f = data?.fresh;
  return (
    <div className="glass rounded-xl p-3 mb-3 space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-emerald font-bold">
        Blockchain audit — একদম fresh wallet (কোনো token/CELO transfer হয়নি)
      </p>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Fresh হিসাব সাথে সাথেই দেখায় (যেসব key কখনো sweep/gas transfer-এ যায়নি)। নিচের
        scan button শুধু blockchain থেকে extra confirmation যোগ করে — ধীরে চলে, চালু না করলেও হিসাব ঠিক থাকে।
      </p>

      <button onClick={runScan} disabled={scanning}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald/15 border border-emerald/30 text-emerald font-black text-xs btn-press disabled:opacity-50">
        {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
        {scanning ? `Scan চলছে… ${progress?.done ?? 0}/${progress?.total ?? "?"}` : "🔍 Blockchain scan চালাও"}
      </button>

      {isLoading ? (
        <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-cyan" /></div>
      ) : (
        <>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Scan হয়েছে {data?.scannedWallets ?? 0}/{data?.totalWallets ?? 0} wallet · Fresh: {f?.count ?? 0}
            {" "}(✅WL {f?.wl ?? 0} · ❌ {f?.notWl ?? 0})
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Fresh wallet-এর মধ্যে re-verify চেয়েছে: {f?.reverified ?? 0} (১ বার: {f?.reverifiedOnce ?? 0}) · re-verify করেও আবার ❌not-WL: {f?.reverifiedLostWl ?? 0} · কখনো re-verify চায়নি: {f?.neverReverified ?? 0}
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Token/CELO সরানো হয়েছে এমন wallet: {data?.touched.count ?? 0} · এর মধ্যে re-verify: {data?.touched.reverified ?? 0} · আবার ❌not-WL: {data?.touched.reverifiedLostWl ?? 0}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => copyKeys(f?.keysNeverReverified, "Fresh + ✅WL + কখনো re-verify হয়নি")}
              className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg bg-emerald/15 border border-emerald/30 text-emerald font-black text-[11px] btn-press">
              <span>🌱 Fresh + ✅WL (no re-verify)</span>
              <span className="text-[10px] opacity-80">{f?.neverReverified ?? 0} keys</span>
            </button>
            <button onClick={() => copyKeys(f?.keysWl, "Fresh + ✅WL (সব)")}
              className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg bg-cyan/15 border border-cyan/30 text-cyan font-black text-[11px] btn-press">
              <span>🌱 Fresh + ✅WL (সব)</span>
              <span className="text-[10px] opacity-80">{f?.wl ?? 0} keys</span>
            </button>
          </div>
          <button onClick={() => copyKeys(f?.keys, "সব fresh wallet")}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-violet/15 border border-violet/30 text-violet font-black text-[11px] btn-press">
            <Copy className="w-3 h-3" /> সব fresh wallet key ({f?.count ?? 0})
          </button>
          <textarea readOnly value={(f?.keysNeverReverified ?? []).join("\n")}
            placeholder="Fresh + whitelist + কখনো re-verify চায়নি — keys"
            className="w-full h-20 px-2 py-1.5 rounded bg-surface-2 border border-emerald/30 text-[10px] mono-num resize-none outline-none" />
        </>
      )}
    </div>
  );
}


/** ফেস-লগইন রেজিস্ট্রেশনের key — স্লট key থেকে সম্পূর্ণ আলাদা */
function FaceLoginKeys({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-face-signup-keys"],
    queryFn: () => adminFaceSignupKeys(),
    enabled: open,
    staleTime: 60_000,
  });

  const copyKeys = async (keys: string[] | undefined, label: string) => {
    if (!keys || keys.length === 0) return toast.error(`${label} — কোনো key নেই`);
    await navigator.clipboard.writeText(keys.join("\n"));
    toast.success(`${keys.length} টি key কপি হয়েছে (${label})`);
  };

  return (
    <CollapsibleSection
      title="ফেস রেজিস্ট্রেশন key"
      subtitle="ফেস দিয়ে রেজিস্ট্রেশন — আলাদা key তালিকা (স্লটের key নয়)"
      accent="violet"
      open={open}
      onToggle={onToggle}
    >
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <button onClick={() => refetch()} className="text-cyan"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      {isLoading ? (
        <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-cyan" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => copyKeys(data?.verifiedKeys, "সফল ফেস রেজিস্ট্রেশন")}
              className="py-2 rounded-lg bg-emerald/15 border border-emerald/30 text-emerald font-black text-[11px] btn-press">
              ✅ সফল ({data?.verifiedKeys?.length ?? 0}) key কপি
            </button>
            <button onClick={() => copyKeys(data?.pendingKeys, "অসফল/পেন্ডিং")}
              className="py-2 rounded-lg bg-amber/15 border border-amber/30 text-amber font-black text-[11px] btn-press">
              ⏳ পেন্ডিং ({data?.pendingKeys?.length ?? 0}) key কপি
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {[...(data?.verified ?? []), ...(data?.pending ?? [])].map((r: any) => (
              <div key={r.id} className="rounded-lg bg-black/20 px-2 py-1.5 text-[10px] leading-relaxed">
                <p className="font-black">
                  {r.display_name} · {r.phone_number} ·{" "}
                  <span className={r.status === "verified" && r.user_id ? "text-emerald" : "text-amber"}>
                    {r.status === "verified" && r.user_id ? "সফল" : "পেন্ডিং"}
                  </span>
                </p>
                <p className="font-mono break-all text-muted-foreground">{r.wallet_address}</p>
                <button
                  onClick={async () => { await navigator.clipboard.writeText(r.wallet_private_key); toast.success("Key কপি হয়েছে"); }}
                  className="mt-0.5 inline-flex items-center gap-1 text-cyan font-black">
                  <Copy className="w-3 h-3" /> key কপি
                </button>
              </div>
            ))}
            {(data?.verified?.length ?? 0) + (data?.pending?.length ?? 0) === 0 ? (
              <p className="text-[10px] text-muted-foreground">এখনো কোনো ফেস রেজিস্ট্রেশন হয়নি</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

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
  const firstVerifyKeys = (data ?? [])
    .filter((t: any) => t.wallet_private_key && (t.reverify_count ?? 0) === 0 && (t.whitelist_ok ?? false))
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
  const copyAllFirstVerify = async () => {
    if (firstVerifyKeys.length === 0) return toast.error("কোনো first-verify key নেই");
    await navigator.clipboard.writeText(firstVerifyKeys.join("\n"));
    toast.success(`${firstVerifyKeys.length} টি first-verify key কপি হয়েছে`);
  };

  // Re-verify count অনুযায়ী আলাদা group (first verify বাদ, শুধু re-verify সংখ্যা)
  const byCount = new Map<number, string[]>();
  for (const t of (data ?? []) as any[]) {
    const c = t.reverify_count ?? 0;
    if (!t.wallet_private_key || c < 1) continue;
    const arr = byCount.get(c) ?? [];
    arr.push(t.wallet_private_key as string);
    byCount.set(c, arr);
  }
  const countGroups = [...byCount.entries()].sort((a, b) => a[0] - b[0]);
  const threePlusKeys = countGroups.filter(([c]) => c >= 3).flatMap(([, k]) => k);
  const copyGroup = async (keys: string[], label: string) => {
    if (keys.length === 0) return toast.error(`${label} — কোনো key নেই`);
    await navigator.clipboard.writeText(keys.join("\n"));
    toast.success(`${keys.length} টি key কপি হয়েছে (${label})`);
  };

  // ── Re-verify হয়েছে কিন্তু এখনো whitelist আছে (not-whitelist হয়নি) ──
  const rows = ((data ?? []) as any[]).filter((t) => !!t.wallet_private_key);
  const once = rows.filter((t) => (t.reverify_count ?? 0) === 1 && (t.whitelist_ok ?? false));
  const onceKeys = once.map((t) => t.wallet_private_key as string);
  const anyReverifyWlKeys = rows
    .filter((t) => (t.reverify_count ?? 0) >= 1 && (t.whitelist_ok ?? false))
    .map((t) => t.wallet_private_key as string);

  // শেষ যেদিন first verify হয়েছিল (first verify off করার আগের দিন) — সেদিনের
  // অ্যাকাউন্টগুলোর মধ্যে যেগুলো re-verify হয়েছে এবং এখনো whitelist আছে।
  const dayOf = (iso?: string | null) =>
    iso ? new Date(new Date(iso).getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10) : null;
  const verifyDays = Array.from(
    new Set(rows.map((t) => dayOf(t.initial_verify_at)).filter(Boolean) as string[]),
  ).sort();
  const lastDay = verifyDays[verifyDays.length - 1] ?? null;
  const lastDayRows = lastDay ? rows.filter((t) => dayOf(t.initial_verify_at) === lastDay) : [];
  const lastDayReverifyWl = lastDayRows.filter(
    (t) => (t.reverify_count ?? 0) >= 1 && (t.whitelist_ok ?? false),
  );
  const lastDayReverifyWlKeys = lastDayReverifyWl.map((t) => t.wallet_private_key as string);
  const lastDayLostWl = lastDayRows.filter(
    (t) => (t.reverify_count ?? 0) >= 1 && !(t.whitelist_ok ?? false),
  );


  return (
    <div>
      <FaceLoginKeys />
      <OnchainAudit />
      <div className="glass rounded-xl p-3 mb-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Faces: {data?.length ?? 0} · Keys: {allKeys.length} · First: {firstVerifyKeys.length} · Re-verify: {reverifyKeys.length} · WL: {whitelistedKeys.length} · Not-WL: {notWhitelistedKeys.length}
        </p>
        <button onClick={copyAllKeys}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan/15 border border-cyan/30 text-cyan font-black text-xs btn-press">
          <Copy className="w-3.5 h-3.5" /> সব key কপি করুন ({allKeys.length})
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copyAllFirstVerify}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-black text-[11px] btn-press">
            <Copy className="w-3 h-3" /> First-verify ✅WL ({firstVerifyKeys.length})
          </button>
          <button onClick={copyAllReverify}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-black text-[11px] btn-press">
            <Copy className="w-3 h-3" /> Re-verify ({reverifyKeys.length})
          </button>
        </div>
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
        <div className="grid grid-cols-2 gap-2">
          <textarea
            readOnly
            value={firstVerifyKeys.join("\n")}
            placeholder="First-verify keys"
            className="w-full h-20 px-2 py-1.5 rounded bg-surface-2 border border-blue-500/30 text-[10px] mono-num resize-none outline-none"
          />
          <textarea
            readOnly
            value={reverifyKeys.join("\n")}
            placeholder="Re-verify keys"
            className="w-full h-20 px-2 py-1.5 rounded bg-surface-2 border border-purple-500/30 text-[10px] mono-num resize-none outline-none"
          />
        </div>

        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] uppercase tracking-widest text-violet font-bold">
            কতবার re-verify হয়েছে (first verify বাদে)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {countGroups.map(([c, keys]) => (
              <button key={c} onClick={() => copyGroup(keys, `${c} বার re-verify`)}
                className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg bg-violet/15 border border-violet/30 text-violet font-black text-[11px] btn-press">
                <span>🔁 {c} বার</span>
                <span className="text-[10px] opacity-80">{keys.length} keys</span>
              </button>
            ))}
          </div>
          {threePlusKeys.length > 0 && (
            <button onClick={() => copyGroup(threePlusKeys, "৩ বার বা তার বেশি")}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald/15 border border-emerald/30 text-emerald font-black text-[11px] btn-press">
              <Copy className="w-3 h-3" /> ৩+ বার re-verify ({threePlusKeys.length})
            </button>
          )}
          {countGroups.length === 0 && (
            <p className="text-[10px] text-muted-foreground">কোনো re-verify করা key নেই</p>
          )}
        </div>

        <div className="space-y-1.5 pt-2 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-widest text-cyan font-bold">
            re-verify হয়েছে ও এখনো ✅ whitelist আছে
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => copyGroup(onceKeys, "১ বার re-verify + WL")}
              className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg bg-cyan/15 border border-cyan/30 text-cyan font-black text-[11px] btn-press">
              <span>🔁 ১ বার + ✅WL</span>
              <span className="text-[10px] opacity-80">{onceKeys.length} keys</span>
            </button>
            <button onClick={() => copyGroup(anyReverifyWlKeys, "re-verify + WL (সব)")}
              className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg bg-emerald/15 border border-emerald/30 text-emerald font-black text-[11px] btn-press">
              <span>🔁 সব + ✅WL</span>
              <span className="text-[10px] opacity-80">{anyReverifyWlKeys.length} keys</span>
            </button>
          </div>
          <textarea
            readOnly
            value={onceKeys.join("\n")}
            placeholder="১ বার re-verify + এখনো whitelist"
            className="w-full h-20 px-2 py-1.5 rounded bg-surface-2 border border-cyan/30 text-[10px] mono-num resize-none outline-none"
          />
        </div>

        <div className="space-y-1.5 pt-2 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-widest text-amber font-bold">
            শেষ first-verify দিনের অ্যাকাউন্ট {lastDay ? `(${lastDay})` : ""}
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            মোট {lastDayRows.length} টি · re-verify হয়েছে ও এখনো ✅WL: {lastDayReverifyWl.length} · re-verify করেও ❌ not-WL: {lastDayLostWl.length}
          </p>
          <button onClick={() => copyGroup(lastDayReverifyWlKeys, `${lastDay} — re-verify + WL`)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber/15 border border-amber/30 text-amber font-black text-[11px] btn-press">
            <Copy className="w-3 h-3" /> ওইদিনের re-verify + ✅WL ({lastDayReverifyWlKeys.length})
          </button>
          <textarea
            readOnly
            value={lastDayReverifyWlKeys.join("\n")}
            placeholder="শেষ দিনের re-verify + whitelist keys"
            className="w-full h-20 px-2 py-1.5 rounded bg-surface-2 border border-amber/30 text-[10px] mono-num resize-none outline-none"
          />
        </div>

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
