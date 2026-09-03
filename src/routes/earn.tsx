import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { isLiteBuild } from "@/lib/lite-build";

export const Route = createFileRoute("/earn")({
  head: () => ({
    meta: [
      { title: "Earn Money Online with Good-App — Mining, Reels & USDT Payouts" },
      {
        name: "description",
        content:
          "Good-App lets you earn online every day: daily mining rewards, referral bonuses and instant USDT (Celo) or mobile-wallet payouts. Free to join.",
      },
      { property: "og:title", content: "Earn Money Online with Good-App" },
      {
        property: "og:description",
        content:
          "Daily mining rewards, referral bonuses and fast USDT payouts. Join Good-App free and start earning today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => {
    if (isLiteBuild()) throw redirect({ to: "/home" });
  },
  component: EarnLanding,
});

const FEATURES = [
  {
    icon: "⛏️",
    title: "Daily mining rewards",
    body: "Stay active in the app for one hour a day and claim your mining balance. No hardware, no fees, no hidden steps.",
  },
  {
    icon: "🎬",
    title: "Reels & Messenger",
    body: "Watch short videos, chat with friends and build your network — the same app you use for fun pays you back.",
  },
  {
    icon: "👥",
    title: "Referral bonuses",
    body: "Invite friends with your personal link and earn a bonus every time an invited user completes verification.",
  },
  {
    icon: "💵",
    title: "USDT (Celo) payouts",
    body: "Withdraw straight to your USDT wallet on the Celo network, or to a local mobile wallet if you prefer.",
  },
];

const STEPS = [
  "Create a free account with your email.",
  "Verify your identity once — it takes a couple of minutes.",
  "Use the app daily: mining, reels, messenger, referrals.",
  "Request a payout in USDT or your local wallet.",
];

function EarnLanding() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-3xl px-5 pt-16 pb-10 text-center">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan">Good-App</p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-black leading-tight">
          Earn money online — every single day
        </h1>
        <p className="mt-4 text-sm sm:text-base text-muted-foreground">
          Good-App combines daily mining rewards, reels, messenger and referral bonuses in one lightweight
          app. Withdraw your earnings in USDT on the Celo network or to a local mobile wallet.
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
            <strong className="text-foreground">USDT (Celo network)</strong> — available worldwide. Paste your
            USDT address, request the amount and our team sends it manually after review.
          </p>
          <p>
            <strong className="text-foreground">Local mobile wallets</strong> — available for users inside
            Bangladesh, processed on the 1st–3rd of every month.
          </p>
          <p>
            PayPal is not supported. If you do not have a PayPal account you do not need one — USDT covers
            international payouts, and any exchange or wallet that supports Celo USDT can convert it to your
            local currency.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="text-xl font-black">Frequently asked questions</h2>
        <div className="mt-4 space-y-3">
          <div className="glass rounded-xl p-3">
            <h3 className="font-black text-xs">Is Good-App free?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Yes. Creating an account, mining and withdrawing are all free — a small platform fee applies to
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
              Anyone can join and withdraw in USDT. Local mobile-wallet payouts are limited to Bangladesh.
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
