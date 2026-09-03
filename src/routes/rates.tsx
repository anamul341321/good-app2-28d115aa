import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listCountryRates } from "@/lib/countries.functions";
import { Globe2, Gift, Pickaxe, ShieldCheck, ArrowLeft, Percent } from "lucide-react";

export const Route = createFileRoute("/rates")({
  head: () => ({
    meta: [
      { title: "Country Mining Rates & Referral Bonus | Good App" },
      {
        name: "description",
        content:
          "See Good App's monthly mining rate for every country and which countries pay an instant referral bonus. Permanent 10% referral commission worldwide.",
      },
      { property: "og:title", content: "Country Mining Rates & Referral Bonus | Good App" },
      {
        property: "og:description",
        content: "Monthly mining rate per country plus the countries with an instant referral bonus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RatesPage,
});

function RatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["country-rates"],
    queryFn: () => listCountryRates(),
    staleTime: 300_000,
  });

  const rows = data ?? [];
  const bonusRows = rows.filter((r) => r.referral_bonus_active && r.referral_bonus_bdt > 0);
  const others = rows.filter((r) => !(r.referral_bonus_active && r.referral_bonus_bdt > 0));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-16 pt-4">
      <Link to="/home" className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Home
      </Link>

      <header className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-cyan" />
          <h1 className="text-lg font-black">দেশভিত্তিক মাইনিং রেট ও রেফার বোনাস</h1>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          কোন দেশের ১০ ঘরে মাসে কত মাইনিং হবে, আর কোন দেশের ইউজার রেফার করলে সাথে সাথে বোনাস পাওয়া যাবে — সব
          এখানে খোলাখুলি দেখানো হয়েছে। রেট অ্যাডমিন প্যানেল থেকে পরিবর্তন হলে এই পেজেও সাথে সাথে আপডেট হবে।
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <InfoChip icon={<Pickaxe className="h-3.5 w-3.5" />} label="সর্বনিম্ন" value="৪০০৳ / মাস" />
          <InfoChip icon={<Pickaxe className="h-3.5 w-3.5" />} label="বাংলাদেশ" value="৫০০৳ / মাস" />
          <InfoChip icon={<Pickaxe className="h-3.5 w-3.5" />} label="সর্বোচ্চ" value="৬০০৳ / মাস" />
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 p-2.5">
          <Percent className="h-4 w-4 shrink-0 text-cyan" />
          <p className="text-[11px] font-bold text-cyan">
            পার্মানেন্ট রেফার কমিশন সব দেশের জন্য ১০% — এটা কখনো বন্ধ হবে না।
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-black text-emerald-400">ইনস্ট্যান্ট রেফার বোনাস চালু আছে যেসব দেশে</h2>
        </div>
        <p className="mt-1 text-[11px] text-emerald-200/80">
          এই দেশগুলোর ইউজার আপনার রেফার কোড দিয়ে একাউন্ট খুললেই সাথে সাথে বোনাস আপনার মেইন ব্যালেন্সে যোগ হবে।
          ইউজারকে অবশ্যই আসলেই সেই দেশে থাকতে হবে — VPN দিয়ে হবে না।
        </p>
        <div className="mt-3 space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground">লোড হচ্ছে…</p>}
          {bonusRows.map((r) => (
            <div
              key={r.code}
              className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{r.flag}</span>
                <div>
                  <p className="text-xs font-black text-emerald-300">{r.name_en}</p>
                  <p className="text-[10px] text-emerald-200/70">
                    মাইনিং {r.monthly_mining_bdt}৳ / মাস (১০ ঘর)
                  </p>
                </div>
              </div>
              <span className="mono-num rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-300">
                +{r.referral_bonus_bdt}৳
              </span>
            </div>
          ))}
          {!isLoading && bonusRows.length === 0 && (
            <p className="text-xs text-muted-foreground">এখন কোনো দেশে ইনস্ট্যান্ট বোনাস চালু নেই।</p>
          )}
        </div>
      </section>

      <section className="glass rounded-2xl p-4">
        <h2 className="text-sm font-black">বাকি দেশগুলোর মাইনিং রেট</h2>
        <div className="mt-3 space-y-2">
          {others.map((r) => (
            <div
              key={r.code}
              className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{r.flag}</span>
                <p className="text-xs font-bold">{r.name_en}</p>
              </div>
              <span className="mono-num text-xs font-black text-cyan">{r.monthly_mining_bdt}৳ / মাস</span>
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-amber" />
          <h2 className="text-sm font-black text-amber">সেফটি নিয়ম (সবার জন্য)</h2>
        </div>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <li>• যে দেশের একাউন্ট, সেই দেশেই থাকতে হবে — সাইনআপের সময় লোকেশন যাচাই হয়।</li>
          <li>• VPN / Proxy / সার্ভার IP দিয়ে বিদেশি একাউন্ট খোলা যাবে না।</li>
          <li>• বাংলাদেশ থেকে অন্য দেশের একাউন্ট খোলা সম্পূর্ণ নিষিদ্ধ।</li>
          <li>• বাংলাদেশ থেকে বিদেশে রেফার করা যাবে — এতে কোনো সমস্যা নেই।</li>
          <li>• ফোনের টাইমজোন সিলেক্ট করা দেশের সাথে মিলতে হবে।</li>
          <li>• নিয়ম ভাঙলে বোনাস বাতিল এবং একাউন্ট বন্ধ হতে পারে।</li>
        </ul>
        <Link to="/rules" className="mt-3 inline-flex text-[11px] font-bold text-cyan underline">
          সব নিয়ম দেখুন
        </Link>
      </section>
    </div>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-2.5">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mono-num mt-0.5 text-sm font-black text-cyan">{value}</p>
    </div>
  );
}
