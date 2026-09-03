import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Coins, Check, Lock, Palette, Smile, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCoinSummary } from "@/components/social/CoinWallet";
import { formatCoins } from "@/lib/coins";
import { EMOJI_PACKS, THEMES, applyTheme, setActiveEmojiKey } from "@/lib/cosmetics";
import { getCosmetics, buyCosmetic, equipCosmetic, type CosmeticState } from "@/lib/cosmetics.functions";
import { playUiSound } from "@/lib/ui-sounds";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "কয়েন শপ — থিম ও ইমোজি প্যাক" },
      { name: "description", content: "জমানো Good Coin খরচ করে প্রিমিয়াম থিম আর ইমোজি প্যাক আনলক করুন।" },
      { property: "og:title", content: "কয়েন শপ — থিম ও ইমোজি প্যাক" },
      { property: "og:description", content: "কয়েন দিয়ে অ্যাপের থিম আর ইমোজি প্যাক আনলক করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoinShopPage,
});

function CoinShopPage() {
  const queryClient = useQueryClient();
  const { data: wallet } = useCoinSummary();
  const { data, isLoading } = useQuery({
    queryKey: ["cosmetics"],
    queryFn: () => getCosmetics() as Promise<CosmeticState>,
    staleTime: 30_000,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"theme" | "emoji">("theme");

  const owned = useMemo(() => new Set(data?.owned ?? []), [data]);
  const balance = wallet?.balance ?? 0;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cosmetics"] }),
      queryClient.invalidateQueries({ queryKey: ["coin-summary"] }),
    ]);
  };

  const handleBuy = async (key: string, cost: number, name: string) => {
    if (busy) return;
    if (balance < cost) {
      toast.error("কয়েন কম পড়েছে — অ্যাপ ব্যবহার করে আরও কয়েন জমান");
      return;
    }
    setBusy(key);
    try {
      const res = await buyCosmetic({ data: { itemKey: key } });
      if (res?.ok) {
        playUiSound("coin");
        toast.success(`${name} আনলক হয়েছে! 🎉`);
        await refresh();
      } else if (res?.error === "insufficient") {
        toast.error("কয়েন কম পড়েছে");
      } else {
        toast.error("আনলক করা যায়নি, আবার চেষ্টা করুন");
      }
    } catch {
      toast.error("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
    } finally {
      setBusy(null);
    }
  };

  const handleEquip = async (kind: "theme" | "emoji", key: string, name: string) => {
    if (busy) return;
    setBusy(key);
    // Instant feedback, then persist.
    if (kind === "theme") applyTheme(key);
    else setActiveEmojiKey(key);
    try {
      const res = await equipCosmetic({
        data: kind === "theme" ? { themeKey: key } : { emojiKey: key },
      });
      if (res?.ok) {
        toast.success(`${name} চালু হয়েছে`);
        await refresh();
      } else {
        toast.error("চালু করা যায়নি");
      }
    } catch {
      toast.error("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pb-28">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/coins" aria-label="পেছনে" className="btn-press grid h-10 w-10 place-items-center rounded-2xl bg-surface-2">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-black">কয়েন শপ</h1>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1.5 text-[12px] font-black text-amber-950">
          <Coins className="h-4 w-4" /> <span className="tabular-nums">{formatCoins(balance)}</span>
        </span>
      </div>

      <p className="mb-4 rounded-2xl bg-surface-2/70 p-3 text-[12px] font-bold leading-relaxed text-muted-foreground">
        অ্যাপ ব্যবহার করে জমানো কয়েন দিয়ে এখানে অ্যাপের <b className="text-foreground">থিম</b> আর{" "}
        <b className="text-foreground">ইমোজি প্যাক</b> আনলক করতে পারবেন। এগুলো শুধুই অ্যাপের ভেতরের সাজসজ্জা — কয়েন
        টাকা দিয়ে কেনা যায় না, বিক্রি বা ট্রান্সফারও করা যায় না।
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2/70 p-1.5">
        {([
          { k: "theme" as const, label: "থিম", icon: Palette },
          { k: "emoji" as const, label: "ইমোজি প্যাক", icon: Smile },
        ]).map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`btn-press flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-black transition-colors ${
              tab === k ? "gradient-cta text-white" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {tab === "theme"
            ? THEMES.map((t) => {
                const isOwned = t.cost === 0 || owned.has(t.key);
                const active = (data?.theme_key ?? "default") === t.key;
                return (
                  <ItemCard
                    key={t.key}
                    name={t.name}
                    desc={t.desc}
                    cost={t.cost}
                    owned={isOwned}
                    active={active}
                    busy={busy === t.key}
                    preview={
                      <span className="flex gap-1">
                        {t.swatch.map((c) => (
                          <span key={c} className="h-7 w-3.5 rounded-full" style={{ background: c }} />
                        ))}
                      </span>
                    }
                    onBuy={() => handleBuy(t.key, t.cost, t.name)}
                    onEquip={() => handleEquip("theme", t.key, t.name)}
                  />
                );
              })
            : EMOJI_PACKS.map((e) => {
                const isOwned = e.cost === 0 || owned.has(e.key);
                const active = (data?.emoji_key ?? "classic") === e.key;
                return (
                  <ItemCard
                    key={e.key}
                    name={e.name}
                    desc={e.desc}
                    cost={e.cost}
                    owned={isOwned}
                    active={active}
                    busy={busy === e.key}
                    preview={<span className="text-lg leading-none">{e.emojis.slice(0, 4).join("")}</span>}
                    onBuy={() => handleBuy(e.key, e.cost, e.name)}
                    onEquip={() => handleEquip("emoji", e.key, e.name)}
                  />
                );
              })}
        </div>
      )}

      <p className="mt-5 flex items-start gap-2 rounded-2xl bg-surface-2/60 p-3 text-[11px] font-bold text-muted-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        আনলক করা থিম বা ইমোজি প্যাক আপনার অ্যাকাউন্টে থেকে যাবে — যখন চান বদলে নিতে পারবেন।
      </p>
    </div>
  );
}

function ItemCard({
  name,
  desc,
  cost,
  owned,
  active,
  busy,
  preview,
  onBuy,
  onEquip,
}: {
  name: string;
  desc: string;
  cost: number;
  owned: boolean;
  active: boolean;
  busy: boolean;
  preview: React.ReactNode;
  onBuy: () => void;
  onEquip: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-2">{preview}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-black">{name}</p>
        <p className="truncate text-[11px] font-bold text-muted-foreground">{desc}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-black text-amber-500">
          {cost === 0 ? "ফ্রি" : (
            <>
              <Coins className="h-3.5 w-3.5" /> <span className="tabular-nums">{formatCoins(cost)}</span> কয়েন
            </>
          )}
        </p>
      </div>
      {active ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-2 text-[11px] font-black text-emerald-500">
          <Check className="h-3.5 w-3.5" /> চালু
        </span>
      ) : (
        <button
          onClick={owned ? onEquip : onBuy}
          disabled={busy}
          className={`btn-press flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-black disabled:opacity-60 ${
            owned ? "bg-surface-2 text-foreground" : "gradient-cta text-white"
          }`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : owned ? <Check className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {owned ? "চালু করুন" : "আনলক"}
        </button>
      )}
    </div>
  );
}
