/**
 * Server-only: "আমার সব হিসাব দেখান" — ধাপে ধাপে পূর্ণ হিসাব (বোনাস + মাইনিং)
 * টেলিগ্রামের জন্য ছোট, পরিষ্কার লেখা আকারে + হিসাবের ছবি (image) লিংক।
 */
import { createHmac } from "node:crypto";

const bdt = (n: number) => `${Number(n || 0).toFixed(2)}৳`;

function signSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.TG_MOD_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    "good-app-hisab"
  );
}

/** এক ঘণ্টার bucket — লিংক অল্প সময়ের জন্যই বৈধ থাকে। */
export function currentHisabBucket(): number {
  return Math.floor(Date.now() / 3_600_000);
}

export function signHisab(uid: string, bucket: number): string {
  return createHmac("sha256", signSecret()).update(`hisab:${uid}:${bucket}`).digest("base64url");
}

function siteBase(): string {
  const raw = process.env.PUBLIC_SITE_URL || "https://good-app2.lovable.app";
  return raw.replace(/\/+$/, "");
}

/**
 * হিসাবের ছবির URL (টেলিগ্রাম সরাসরি এই লিংক থেকে ছবি নিয়ে পাঠাতে পারে)।
 * কার্ডের HTML পেজটি ছবি বানিয়ে দেয় একটি রেন্ডার সার্ভিস।
 */
export function hisabImageUrl(uid: string): string {
  const digits = String(uid).replace(/\D/g, "");
  const page = `${siteBase()}/api/public/hisab-card?uid=${digits}&t=${signHisab(digits, currentHisabBucket())}`;
  return `https://image.thum.io/get/width/900/crop/1400/noanimate/${page}`;
}


/** ইউজার "মোট হিসাব / full details / ধাপে ধাপে" চাইছে কি না। */
export function wantsFullHisab(text: string): boolean {
  const s = String(text || "").toLowerCase();
  return (
    /(hisab|হিসাব|হিসেব|calculation|breakdown|ধাপে|dhape|detail|ডিটেইল|full|total|মোট|সব হিসাব|statement|স্টেটমেন্ট)/i.test(s)
  );
}

/**
 * UID থেকে ধাপে ধাপে হিসাব বানায়। একাউন্ট না পেলে null।
 */
export async function fullHisabText(uid: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const digits = String(uid).replace(/\D/g, "");
  if (!digits) return null;
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("id, uid_seq, display_name")
    .eq("uid_seq", Number(digits))
    .maybeSingle();
  if (!prof?.id) return null;

  const { buildEarningsBreakdown } = await import("@/lib/earnings-breakdown.server");
  const b = await buildEarningsBreakdown(supabaseAdmin, (prof as any).id);

  const bonusLines = b.bonus.steps
    .slice(0, 6)
    .map((s) => `   • ${s.label}${s.formula ? ` — ${s.formula}` : ""} = <b>${bdt(s.amount)}</b>`)
    .join("\n");

  const mining = b.mining;
  const miningLines = [
    `   • নিজের রি-ভেরিফাইড স্লট: <b>${mining.selfSlots}</b> টি × ৫০৳/মাস = <b>${bdt(mining.monthlySelf)}</b>`,
    `   • রেফার ১০% কমিশন: <b>${bdt(mining.monthlyReferral)}</b>/মাস (${mining.referees.length} জন সক্রিয় রেফার)`,
    `   • মোট মাসিক রেট: <b>${bdt(mining.monthlyTotal)}</b> → প্রতিদিন <b>${bdt(mining.perDay)}</b>`,
    mining.activatedAt
      ? `   • মাইনিং চালু আছে <b>${mining.daysRunning.toFixed(2)}</b> দিন → জমা <b>${bdt(mining.total)}</b>`
      : `   • মাইনিং এখনো চালু হয়নি (১০টি রি-ভেরিফাই শেষ হলেই চালু)`,
  ].join("\n");

  return (
    `🧾 <b>${(prof as any).display_name || "ইউজার"} — UID ${(prof as any).uid_seq} এর ধাপে ধাপে হিসাব</b>\n\n` +
    `🎁 <b>বোনাস মোট: ${bdt(b.bonus.total)}</b>\n` +
    (bonusLines || `   • এখনো কোনো বোনাস যোগ হয়নি`) +
    `\n\n⛏️ <b>মাইনিং মোট: ${bdt(mining.total)}</b>\n` +
    miningLines +
    `\n   ↳ নিজের স্লট থেকে <b>${bdt(mining.selfTotal)}</b> · রেফার কমিশন <b>${bdt(mining.referralTotal)}</b>\n\n` +
    `💰 <b>সব মিলিয়ে: ${bdt(b.bonus.total + mining.total)}</b>\n\n` +
    `📸 পুরো হিসাবের <b>ছবি (ছবি আকারে ডাউনলোড/শেয়ার)</b> নিতে চাইলে — অ্যাপের <b>Earnings</b> পেজে গিয়ে ` +
    `“ধাপে ধাপে হিসাব” এর নিচে <b>ডাউনলোড</b> বাটনে চাপ দিন, পুরো হিসাবের ছবি গ্যালারিতে সেভ হয়ে যাবে 💙`
  );
}
