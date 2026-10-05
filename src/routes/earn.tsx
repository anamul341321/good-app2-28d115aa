import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { isLiteBuild } from "@/lib/lite-build";
import { isStoreBuild } from "@/lib/store-build";

export const Route = createFileRoute("/earn")({
  head: () => ({
    meta: [
      { title: "Good-App — Slot Verification & Task Rewards in Bangladesh" },
      {
        name: "description",
        content:
          "Good-App for Bangladesh: slot verification, daily task reward claims, referral bonuses and bKash/Nagad withdrawals. Free to join.",
      },
      { property: "og:title", content: "Earn Money Online with Good-App" },
      {
        property: "og:description",
        content:
          "Daily task reward claims, referral bonuses and bKash/Nagad withdrawals for users in Bangladesh.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => {
    if (isLiteBuild() || isStoreBuild()) throw redirect({ to: "/home" });
  },
  component: EarnLanding,
});

const FEATURES = [
  {
    icon: "⛏️",
    title: "Daily task rewards",
    body: "Claim your daily task reward balance from verified slots. No hardware, no fees, no hidden steps.",
  },
  {
    icon: "👥",
    title: "Referral bonuses",
    body: "Invite friends with your personal link and earn a bonus every time an invited user completes verification.",
  },
  {
    icon: "💵",
    title: "bKash / Nagad payouts",
    body: "Withdraw your balance in BDT to bKash or Nagad. Available in Bangladesh only.",
  },
];

const STEPS = [
  "Create a free account with your email.",
  "Verify your identity once — it takes a couple of minutes.",
  "Claim your daily task rewards and invite friends.",
  "Request a payout to bKash or Nagad.",
];

function EarnLanding() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-3xl px-5 pt-16 pb-10 text-center">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan">Good-App</p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-black leading-tight">
          Task rewards for Bangladesh
        </h1>
        <p className="mt-4 text-sm sm:text-base text-muted-foreground">
          Good-App combines slot verification, daily task rewards and referral bonuses in one lightweight
          app for Bangladesh. Withdraw to bKash or Nagad.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            className="px-6 py-3 rounded-xl bg-cyan text-background font-black text-sm shadow-lg"
          >
            Join free
          </Link>
          <Link to="/download" className="px-6 py-3 rounded-xl glass font-black text-sm">
            Download the app
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-10">
        <h2 className="text-xl font-black">What you get</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.title} className="glass rounded-2xl p-4">
              <p className="text-2xl" aria-hidden>
                {f.icon}
              </p>
              <h3 className="mt-2 font-black text-sm">{f.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-10">
        <h2 className="text-xl font-black">How it works</h2>
        <ol className="mt-4 space-y-2">
          {STEPS.map((s, i) => (
            <li key={s} className="glass rounded-xl p-3 flex gap-3 items-start">
              <span className="mono-num font-black text-cyan shrink-0">{i + 1}</span>
              <span className="text-xs text-muted-foreground">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-10">
        <h2 className="text-xl font-black">Payout methods</h2>
        <div className="mt-4 glass rounded-2xl p-4 space-y-2 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">bKash / Nagad (BDT)</strong> — Good-App is available in
            Bangladesh only. Main balance can be withdrawn any day; task reward balance is withdrawable on the
            1st–3rd of every month (until 10 PM).
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="text-xl font-black">Frequently asked questions</h2>
        <div className="mt-4 space-y-3">
          <div className="glass rounded-xl p-3">
            <h3 className="font-black text-xs">Is Good-App free?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Yes. Creating an account, claiming rewards and withdrawing are all free — a small platform fee applies to
              payouts only.
            </p>
          </div>
          <div className="glass rounded-xl p-3">
            <h3 className="font-black text-xs">How much can I earn?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Earnings depend on your daily activity, completed verification slots and referrals. We never
              promise fixed income.
            </p>
          </div>
          <div className="glass rounded-xl p-3">
            <h3 className="font-black text-xs">Which countries are supported?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Good-App is available in Bangladesh only. Payouts go to bKash or Nagad in BDT.
            </p>
          </div>
        </div>
        <div className="mt-8 text-center">
          <Link
            to="/auth"
            className="inline-block px-6 py-3 rounded-xl bg-cyan text-background font-black text-sm"
          >
            Start earning now
          </Link>
        </div>
      </section>
    </main>
  );
}
