import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Loader2, Lock, Pickaxe, RefreshCcw, Sparkles, X } from "lucide-react";
import { claimSlotReward } from "@/lib/slot-claims.functions";
import { claimSlotMining } from "@/lib/earnings.functions";

export type SlotClaim = { taskId: string; slot: number; bonus: number; mining: number; dueAt?: string | null; whitelistOk?: boolean };

const dueText = (dueAt?: string | null) => {
  if (!dueAt) return null;
  const ts = new Date(dueAt).getTime();
  if (!Number.isFinite(ts)) return null;
  const days = Math.ceil((ts - Date.now()) / 86400000);
  if (days > 0) return `⏳ এই ঘরের পরবর্তী Re-verify আসবে ${new Date(ts).toLocaleDateString("bn-BD")} (≈${days} দিন পরে) — তখনই টাকাটা খুলবে।`;
  return "✅ এই ঘরের Re-verify এখন খোলা — এখনই Re-verify করলেই টাকাটা ক্লেইম হবে।";
};

const tk = (n: number) => `${n.toFixed(2)}৳`;

/**
 * ঘরের ঠিক নিচে বসে থাকা ক্লেইম বাটন — ওই ঘরের রি-ভেরিফাই বোনাস (১০৳) এবং
 * ওই ঘর থেকে যত মাইনিং হয়েছে, দুটোই একসাথে মেইন ব্যালেন্সে নেওয়া যায়।
 * কনফার্ম করার আগে কোনটা বোনাস, কোনটা মাইনিং — আলাদা করে দেখানো হয়।
 */
export function SlotClaimButton({
  claim,
  compact = false,
  preview,
  onReverify,
}: {
  claim?: SlotClaim | null;
  compact?: boolean;
  /** রি-ভেরিফাই করার আগেই দেখানো হবে — কত টাকা অপেক্ষা করছে (লক অবস্থায়) */
  preview?: SlotClaim | null;
  onReverify?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => claimSlotReward({ data: { taskId: claim!.taskId } }),
    onSuccess: (r: any) => {
      setOpen(false);
      toast.success(
        `🎉 ${tk(Number(r?.total ?? 0))} মেইন ব্যালেন্সে যোগ হয়েছে` +
          ` · বোনাস ${tk(Number(r?.bonus ?? 0))} + মাইনিং ${tk(Number(r?.mining ?? 0))}`,
      );
      void qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "ক্লেইম করা যায়নি"),
  });

  // Re-verify চাওয়ার আগেই: ওই ঘরের জমা মাইনিং (বোনাস ছাড়া) এখনই মেইন ব্যালেন্সে
  const miningMut = useMutation({
    mutationFn: () => claimSlotMining({ data: { taskId: (preview ?? claim)!.taskId } }),
    onSuccess: (r: any) => {
      setOpen(false);
      toast.success(`⛏️ মাইনিং ${tk(Number(r?.mining ?? 0))} মেইন ব্যালেন্সে যোগ হয়েছে`);
      void qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "ক্লেইম করা যায়নি"),
  });

  // ── রি-ভেরিফাই করার আগে: লক করা (teaser) বাটন ─────────────────────────────
  const locked = !claim && !!preview;
  const data = claim ?? preview ?? null;
  if (!data) return null;
  // ঘরটি এখন whitelist-এ না থাকলে (Re-verify চাওয়া হয়েছে) → মাইনিং + বোনাস দুটোই লক
  const dueTs = data.dueAt ? new Date(data.dueAt).getTime() : NaN;
  const reverifyDue = locked && data.whitelistOk !== true;
  const miningClaimableNow = locked && data.whitelistOk === true;
  void dueTs;

  const total = data.bonus + data.mining;
  if (total <= 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`mt-1.5 w-full rounded-xl ${compact ? "py-1.5 text-[10.5px]" : "py-2 text-[12px]"} font-black ${locked ? "text-amber-950 border-amber-200 shadow-[0_8px_18px_-8px_rgba(245,158,11,0.9)]" : "text-emerald-950 border-emerald-300 shadow-[0_8px_18px_-8px_rgba(16,185,129,0.9)]"} flex items-center justify-center gap-1 btn-press border relative overflow-hidden`}
        style={{ background: locked ? "linear-gradient(120deg,#fde68a,#fbbf24,#f59e0b)" : "linear-gradient(120deg,#6ee7b7,#34d399,#10b981)" }}
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.6),transparent_55%)]" />
        {locked ? <Lock className="w-3.5 h-3.5 relative" /> : <Gift className="w-3.5 h-3.5 relative" />}
        <span className="relative">{tk(total)} ক্লেইম</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl overflow-hidden border border-white/20 shadow-2xl"
               style={{ background: "linear-gradient(160deg,#0f172a,#122c4a 55%,#0b3b34)" }}>
            <div className="flex items-center justify-between px-4 pt-4">
              <p className="text-[11px] font-black tracking-[0.2em] uppercase text-emerald-200">
                ঘর #{data.slot} · পুরস্কার
              </p>
              <button onClick={() => setOpen(false)} className="p-1 rounded-full bg-white/10 text-white/80">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 pt-2 pb-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/55 font-black">মোট ক্লেইম</p>
              <p className="mono-num text-[2.2rem] leading-none font-black text-white drop-shadow">{tk(total)}</p>
              <p className={`text-[10.5px] font-bold mt-1 ${locked ? "text-amber-200" : "text-emerald-200"}`}>
                {locked
                  ? reverifyDue
                    ? "🔒 এই ঘরে Re-verify চাওয়া হয়েছে — মাইনিং ও ১০৳ বোনাস দুটোই Re-verify করলেই খুলবে"
                    : "⛏️ মাইনিং টাকা এখনই নিতে পারবেন · 🔒 ১০৳ বোনাস শুধু Re-verify করলেই"
                  : "ক্লেইম করলেই টাকা মেইন ব্যালেন্সে যাবে"}
              </p>
              {locked && dueText(data.dueAt) && (
                <p className="text-[9.5px] font-bold mt-1 text-white/70 leading-snug">{dueText(data.dueAt)}</p>
              )}
            </div>

            <div className="px-4 mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl p-2.5 border border-yellow-200/30 bg-yellow-300/10">
                <p className="text-[9px] font-black tracking-widest text-yellow-100 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> বোনাস
                </p>
                <p className="mono-num text-[17px] font-black text-yellow-100 mt-0.5">{tk(data.bonus)}</p>
                <p className="text-[8.5px] text-white/60 leading-tight mt-0.5">
                  এই ঘর আবার Re-verify করার উপহার
                </p>
              </div>
              <div className="rounded-2xl p-2.5 border border-cyan-200/30 bg-cyan-300/10">
                <p className="text-[9px] font-black tracking-widest text-cyan-100 flex items-center gap-1">
                  <Pickaxe className="w-3 h-3" /> মাইনিং
                </p>
                <p className="mono-num text-[17px] font-black text-cyan-100 mt-0.5">{tk(data.mining)}</p>
                <p className="text-[8.5px] text-white/60 leading-tight mt-0.5">
                  এই ঘর থেকে জমা হওয়া মাইনিং আয়
                </p>
              </div>
            </div>

            <div className="mx-4 mt-3 rounded-2xl border border-white/15 bg-white/5 p-3 space-y-1.5">
              <p className="text-[10px] font-black text-white/85 tracking-wide">📜 নিয়মগুলো</p>
              {(locked
                ? [
                    reverifyDue
                      ? "এই ঘরে GoodDollar Re-verify চেয়ে ফেলেছে — তাই এই ঘরের মাইনিং টাকা লক। Re-verify করলেই মাইনিং + ১০৳ বোনাস একসাথে খুলবে।"
                      : "মাইনিং = এই ঘর থেকে জমা হওয়া আয় (৫০৳/মাস হারে) — GoodDollar এখনো Re-verify চায়নি, তাই এটা যেকোনো সময় মেইন ব্যালেন্সে নিতে পারবেন (উইথড্র শুধু মাসের ১–৩ তারিখে)।",
                    "১০৳ বোনাস = শুধু এই ঘর আবার Re-verify করলেই খুলবে (আগে একবার Re-verify করা ঘরের জন্য)।",
                    "যে ঘর প্রথমবার Re-verify-ই হয়নি বা এখনো whitelist হয়নি — সেখানে ১০৳ বোনাস নেই, শুধু মাইনিং।",
                    "টাকা কখনো নষ্ট হয় না — না নিলে ঘরের নিচেই জমা থাকবে ও বাড়তে থাকবে।",
                    "রেফারের ১০% কমিশন ঘরের সাথে লক নয় — মাইনিং কার্ডের 🤝 রেফার কমিশন থেকে যেকোনো সময় ক্লেইম করা যায়।",
                    "ক্লেইম করা টাকা মেইন ব্যালেন্সে যাবে — বোনাস যেকোনো সময়, মাইনিং প্রতি মাসের ১–৩ তারিখে তোলা যাবে।",
                  ]
                : [
                "বোনাস = এই ঘর আবার Re-verify করার জন্য ১০৳ (উপহার)।",
                "মাইনিং = শুধু এই ঘর থেকে জমা হওয়া আয় (৫০৳/মাস হারে)।",
                "ক্লেইম করলে দুটোই মেইন ব্যালেন্সে যোগ হবে — একসাথে।",
                "মেইন ব্যালেন্সের বোনাস অংশ যেকোনো সময় উইথড্র/সেন্ড করা যাবে; মাইনিং অংশের উইথড্র শুধু ১–৩ তারিখে।",
                "ক্লেইম না করলে টাকা নষ্ট হবে না — ঘরের নিচেই জমা থাকবে।",
                  ]
              ).map((line, i) => (
                <p key={i} className="text-[10px] text-white/70 font-bold leading-snug">• {line}</p>
              ))}
            </div>

            <div className="p-4 pt-3 space-y-2">
              {locked ? (
                <>
                  {miningClaimableNow && data.mining >= 0.5 && (
                    <button
                      disabled={miningMut.isPending}
                      onClick={() => miningMut.mutate()}
                      className="w-full rounded-2xl py-3 font-black text-[13px] text-cyan-950 flex items-center justify-center gap-2 btn-press border border-white/40 disabled:opacity-70"
                      style={{ background: "linear-gradient(120deg,#a5f3fc,#22d3ee,#06b6d4)" }}
                    >
                      {miningMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pickaxe className="w-4 h-4" />}
                      শুধু মাইনিং {tk(data.mining)} এখনই নিন
                    </button>
                  )}
                  <button
                    onClick={() => { setOpen(false); onReverify?.(); }}
                    className="w-full rounded-2xl py-3 font-black text-[13px] text-amber-950 flex items-center justify-center gap-2 btn-press border border-white/40"
                    style={{ background: "linear-gradient(120deg,#fde68a,#fbbf24,#f59e0b)" }}
                  >
                    <RefreshCcw className="w-4 h-4" />
                    Re-verify করে {tk(data.bonus)} বোনাসসহ নিন
                  </button>
                </>
              ) : (
              <button
                disabled={mut.isPending}
                onClick={() => mut.mutate()}
                className="w-full rounded-2xl py-3 font-black text-[13px] text-emerald-950 flex items-center justify-center gap-2 btn-press border border-white/40 disabled:opacity-70"
                style={{ background: "linear-gradient(120deg,#a7f3d0,#34d399,#059669)" }}
              >
                {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                হ্যাঁ, {tk(total)} মেইন ব্যালেন্সে নিন
              </button>
              )}
              <button onClick={() => setOpen(false)}
                      className="w-full rounded-2xl py-2.5 font-black text-[12px] text-white/80 border border-white/20 bg-white/5">
                পরে করব
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
