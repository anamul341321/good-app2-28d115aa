import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listCountryRates } from "@/lib/countries.functions";
import { Globe2, Gift, Pickaxe, ShieldCheck, ArrowLeft, Percent } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { money, moneyText, USDT_BDT_RATE } from "@/lib/money";
import { REGIONS, getRegion } from "@/lib/regions";

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
  const { t, countryCode } = useLang();
  const { data, isLoading } = useQuery({
    queryKey: ["country-rates"],
    queryFn: () => listCountryRates(),
    staleTime: 300_000,
  });

  const rows = data ?? [];
  const bonusRows = rows.filter((r) => r.referral_bonus_active && r.referral_bonus_bdt > 0);
  const others = rows.filter((r) => !(r.referral_bonus_active && r.referral_bonus_bdt > 0));

  /** নিজের দেশ অনুযায়ী টাকা / USDT দেখানো */
  const show = (bdt: number) => moneyText(bdt, countryCode);
  const isBD = countryCode === "BD";
  const myRegion = getRegion(countryCode);

  const flagOf = (code: string) => REGIONS.find((r) => r.code === code)?.flag ?? "🌐";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-16 pt-4">
      <Link to="/home" className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Home
      </Link>

      <header className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-cyan" />
          <h1 className="text-lg font-black">
            {t("দেশভিত্তিক মাইনিং রেট ও রেফার বোনাস", "Mining rate & referral bonus by country")}
          </h1>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t(
            "কোন দেশের ১০ ঘরে মাসে কত মাইনিং হবে, আর কোন দেশের ইউজার রেফার করলে সাথে সাথে বোনাস পাওয়া যাবে — সব এখানে খোলাখুলি দেখানো হয়েছে।",
            "See exactly how much every country mines per month with 10 slots, and which countries pay an instant referral bonus.",
          )}
        </p>
        <p className="mt-1 text-[11px] font-bold text-cyan">
          {isBD
            ? "আপনি বাংলাদেশ থেকে দেখছেন — তাই সব হিসাব টাকায় (৳) দেখানো হচ্ছে।"
            : `You are viewing from ${myRegion.flag} ${myRegion.nameEn} — payouts are shown in USDT with an approximate ${myRegion.currency} value (1 USDT ≈ ৳${USDT_BDT_RATE}).`}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <InfoChip icon={<Pickaxe className="h-3.5 w-3.5" />} label={t("সর্বনিম্ন", "Lowest")} value={show(400)} />
          <InfoChip icon={<Pickaxe className="h-3.5 w-3.5" />} label={t("বাংলাদেশ", "Bangladesh")} value={show(500)} />
          <InfoChip icon={<Pickaxe className="h-3.5 w-3.5" />} label={t("সর্বোচ্চ", "Highest")} value={show(600)} />
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 p-2.5">
          <Percent className="h-4 w-4 shrink-0 text-cyan" />
          <p className="text-[11px] font-bold text-cyan">
            {t(
              "পার্মানেন্ট রেফার কমিশন সব দেশের জন্য ১০% — এটা কখনো বন্ধ হবে না।",
              "A permanent 10% referral commission applies in every country — it never stops.",
            )}
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-emerald-500/40 bg-surface-2 p-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-black text-foreground">
            {t("ইনস্ট্যান্ট রেফার বোনাস চালু আছে যেসব দেশে", "Countries with an instant referral bonus")}
          </h2>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {t(
            "এই দেশগুলোর ইউজার আপনার রেফার কোড দিয়ে একাউন্ট খুললেই সাথে সাথে বোনাস আপনার মেইন ব্যালেন্সে যোগ হবে। ইউজারকে অবশ্যই আসলেই সেই দেশে থাকতে হবে — VPN দিয়ে হবে না।",
            "When someone from these countries signs up with your referral code, the bonus is added to your main balance instantly. They must really be in that country — VPN does not work.",
          )}
        </p>
        <div className="mt-3 space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground">{t("লোড হচ্ছে…", "Loading…")}</p>}
          {bonusRows.map((r) => (
            <div
              key={r.code}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{r.flag || flagOf(r.code)}</span>
                <div>
                  <p className="text-sm font-black text-foreground">{r.name_en}</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {t("মাইনিং", "Mining")} {show(r.monthly_mining_bdt)} / {t("মাস", "month")} (10 {t("ঘর", "slots")})
                  </p>
                </div>
              </div>
              <span className="mono-num rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-black text-white">
                +{money(r.referral_bonus_bdt, countryCode).main}
              </span>
            </div>
          ))}

          {!isLoading && bonusRows.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("এখন কোনো দেশে ইনস্ট্যান্ট বোনাস চালু নেই।", "No country has an instant bonus right now.")}
            </p>
          )}
        </div>
      </section>

      <section className="glass rounded-2xl p-4">
        <h2 className="text-sm font-black">{t("বাকি দেশগুলোর মাইনিং রেট", "Mining rate of other countries")}</h2>
        <div className="mt-3 space-y-2">
          {others.map((r) => (
            <div
              key={r.code}
              className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{r.flag || flagOf(r.code)}</span>
                <p className="text-xs font-bold">{r.name_en}</p>
              </div>
              <span className="mono-num text-xs font-black text-cyan">
                {show(r.monthly_mining_bdt)} / {t("মাস", "month")}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-amber" />
          <h2 className="text-sm font-black text-amber">{t("সেফটি নিয়ম (সবার জন্য)", "Safety rules (for everyone)")}</h2>
        </div>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <li>
            •{" "}
            {t(
              "যে দেশের একাউন্ট, সেই দেশেই থাকতে হবে — সাইনআপের সময় লোকেশন যাচাই হয়।",
              "You must be in the country you sign up for — location is verified at signup.",
            )}
          </li>
          <li>
            •{" "}
            {t(
              "VPN / Proxy / সার্ভার IP দিয়ে বিদেশি একাউন্ট খোলা যাবে না।",
              "Foreign accounts cannot be opened over VPN, proxy or datacenter IPs.",
            )}
          </li>
          <li>
            •{" "}
            {t(
              "বাংলাদেশ থেকে অন্য দেশের একাউন্ট খোলা সম্পূর্ণ নিষিদ্ধ।",
              "Opening another country's account from Bangladesh is not allowed.",
            )}
          </li>
          <li>
            •{" "}
            {t(
              "বাংলাদেশ থেকে বিদেশে রেফার করা যাবে — এতে কোনো সমস্যা নেই।",
              "Referring people abroad from Bangladesh is perfectly fine.",
            )}
          </li>
          <li>
            • {t("ফোনের টাইমজোন সিলেক্ট করা দেশের সাথে মিলতে হবে।", "Your phone timezone must match the selected country.")}
          </li>
          <li>
            •{" "}
            {t(
              "নিয়ম ভাঙলে বোনাস বাতিল এবং একাউন্ট বন্ধ হতে পারে।",
              "Breaking the rules can cancel the bonus and close the account.",
            )}
          </li>
        </ul>
        <Link to="/rules" className="mt-3 inline-flex text-[11px] font-bold text-cyan underline">
          {t("সব নিয়ম দেখুন", "See all rules")}
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
