/**
 * মালিক (owner) কমান্ড হ্যান্ডলার।
 *
 * শুধুমাত্র `tg_bot_settings.support_username` (ডিফল্ট @anamulmunni) — অর্থাৎ
 * অ্যাপের মালিক — এই কমান্ডগুলো চালাতে পারেন। গ্রুপে বটকে মেনশন করে, বা সরাসরি
 * বটের ইনবক্সে (DM) লিখলেও কাজ হবে।
 *
 * সাপোর্টেড: UID জিজ্ঞেস (শুধু UID), স্লট রিসেট, ওয়ালেট/পেমেন্ট নম্বর রিসেট,
 * অ্যাপের সেটিংস পরিবর্তন (withdraw/recharge on-off, বোনাস রেট, নোটিশ)।
 */

const bnNum = (s: string) =>
  String(s ?? "").replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

/** এই টেলিগ্রাম ইউজারনেমটি অ্যাপের মালিকের কি না। */
export function isOwnerIdentity(
  username: string | null | undefined,
  telegramUserId: number | string | null | undefined,
  supportUsername?: string | null,
  adminChatId?: string | number | null,
): boolean {
  const owner = String(supportUsername || "@anamulmunni")
    .replace(/^@/, "")
    .toLowerCase();
  const usernameMatches = !!username && username.toLowerCase() === owner;
  const savedId = String(adminChatId ?? "").trim();
  return usernameMatches || (!!savedId && savedId === String(telegramUserId ?? ""));
}

export function isOwnerUsername(
  username: string | null | undefined,
  supportUsername?: string | null,
): boolean {
  return isOwnerIdentity(username, null, supportUsername, null);
}

export type OwnerResult = { handled: boolean; reply: string | null; flow: string };

const RESET_INTENT =
  /(reset|রিসেট|muche|মুছে|মুছ|delete|ডিলিট|khali|খালি|clear|ক্লিয়ার|বাদ\s*দা|সরিয়ে)/i;
const WALLET_WORD =
  /(wallet|ওয়ালেট|payment|পেমেন্ট|bkash|বিকাশ|nagad|নগদ|usdt|পেমেন্ট\s*নম্বর|নম্বর|নাম্বার|number)/i;
const UID_ASK = /(uid|ইউআইডি|আইডি|আই\s*ডি)/i;
const DETAIL_ASK =
  /(হিসাব|hisab|details?|ডিটেইল|তথ্য|balance|ব্যালেন্স|slot|স্লট|withdraw|উইথড্র|mining|মাইনিং|earn|আয়|full|পুরো)/i;

/** "uid 4100" / বেয়ার নম্বর থেকে UID বের করে (স্লট নম্বর বাদ দিয়ে)। */
export async function extractUid(rawText: string): Promise<string | null> {
  const { stripSlotMentions } = await import("./telegram-slot.server");
  const cmd = bnNum(rawText);
  return (
    cmd.match(/(?:uid|ইউআইডি|আইডি|\bid\b)\s*[:#-]?\s*(\d{2,9})/i)?.[1] ??
    stripSlotMentions(cmd).match(/(?<![\d@])(\d{3,9})(?![\d])/)?.[1] ??
    null
  );
}

/**
 * মালিকের নির্দেশটি বোঝার চেষ্টা করে এবং পারলে কাজটি করে দেয়।
 * handled=false হলে কলিং কোড স্বাভাবিক AI উত্তরে চলে যাবে।
 */
export async function runOwnerCommand(rawText: string): Promise<OwnerResult> {
  const text = String(rawText ?? "").trim();
  if (!text) return { handled: false, reply: null, flow: "owner-empty" };
  const cmd = bnNum(text);

  const slotMod = await import("./telegram-slot.server");
  const { SLOT_WORD, NUM_WORD } = slotMod;
  const hasSlotWord = new RegExp(SLOT_WORD, "i").test(cmd);

  // ---- ১) স্লট রিসেট ----------------------------------------------------
  if (RESET_INTENT.test(cmd) && hasSlotWord) {
    const uid = await extractUid(cmd);
    if (!uid) {
      return {
        handled: true,
        flow: "owner-reset-need-uid",
        reply: `🙏 জি স্যার — কোন <b>UID</b> এর স্লট রিসেট করব সেটি লিখে দিন।\nযেমন: <code>uid 4100 এর ৪ নম্বর স্লট রিসেট করে দাও</code>`,
      };
    }
    const found: number[] = [];
    for (const m of cmd.matchAll(
      new RegExp(`(\\d{1,3})\\s*${NUM_WORD}?\\s*(?:er|এর)?\\s*${SLOT_WORD}`, "gi"),
    ))
      found.push(Number(m[1]));
    for (const m of cmd.matchAll(
      new RegExp(`${SLOT_WORD}\\s*${NUM_WORD}?\\s*[:#-]?\\s*(\\d{1,3})`, "gi"),
    ))
      found.push(Number(m[1]));
    const uniq = Array.from(new Set(found.filter((n) => n >= 1 && n <= 500)));
    const wantsAll = /(সব|সবগুলো|সবগুলা|all|full)/i.test(cmd);
    const target = uniq.length ? uniq : wantsAll ? await slotMod.listSlotNumbers(uid) : [];
    if (!target.length) {
      return {
        handled: true,
        flow: "owner-reset-need-slot",
        reply: `🙏 জি স্যার — UID <code>${uid}</code> এর <b>কোন স্লট</b> রিসেট করব? (যেমন: <code>৪ নম্বর স্লট</code> বা <code>সব স্লট</code>)`,
      };
    }
    const res = await slotMod.resetSlotsForUid(uid, target);
    const reply = !res.found
      ? `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি স্যার।`
      : `✅ <b>${res.name}</b> (UID <code>${res.uid ?? uid}</code>) —\n` +
        (res.done.length ? `🔄 রিসেট হয়েছে: <b>স্লট ${res.done.join(", ")}</b>\n` : "") +
        (res.failed.length
          ? res.failed.map((f) => `⚠️ স্লট ${f.slot}: ${f.error}`).join("\n") + "\n"
          : "") +
        `এখন নতুন ফেস দিয়ে আবার ভেরিফাই করা যাবে 💙`;
    return { handled: true, reply, flow: "owner-slot-reset" };
  }

  // ---- ২) ওয়ালেট / পেমেন্ট নম্বর রিসেট --------------------------------
  if (RESET_INTENT.test(cmd) && WALLET_WORD.test(cmd)) {
    const uid = await extractUid(cmd);
    if (!uid) {
      return {
        handled: true,
        flow: "owner-wallet-need-uid",
        reply: `🙏 জি স্যার — কোন <b>UID</b> এর পেমেন্ট নম্বর রিসেট করব? যেমন: <code>uid 4100 এর বিকাশ নম্বর রিসেট করো</code>`,
      };
    }
    const provider = /বিকাশ|bkash/i.test(cmd)
      ? "bkash"
      : /নগদ|nagad/i.test(cmd)
        ? "nagad"
        : /usdt/i.test(cmd)
          ? "usdt"
          : null;
    const { resetPaymentNumbersForUid, walletResetReply } =
      await import("./telegram-wallet.server");
    const res = await resetPaymentNumbersForUid(uid, provider);
    return { handled: true, reply: walletResetReply(res), flow: "owner-wallet-reset" };
  }

  // ---- ৩) শুধু UID জানতে চাইলে ------------------------------------------
  if (UID_ASK.test(cmd) && !DETAIL_ASK.test(cmd)) {
    const uid = await extractUid(cmd);
    if (uid) {
      const profile = await slotMod.findProfileByUid(uid);
      return {
        handled: true,
        flow: "owner-uid-only",
        reply: profile
          ? `🆔 UID: <code>${profile.uid_seq ?? uid}</code> — <b>${profile.display_name || "ইউজার"}</b>`
          : `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি স্যার।`,
      };
    }
  }

  // ---- ৪) অ্যাপের সেটিংস পরিবর্তন --------------------------------------
  const { interpretAdminOrder, runAdminOps, opsAnnouncement } =
    await import("./telegram-admin-actions.server");
  const ops = await interpretAdminOrder(cmd);
  if (ops.length) {
    const { done, failed } = await runAdminOps(ops);
    const ann = opsAnnouncement(done, failed);
    if (ann.trim()) return { handled: true, reply: ann, flow: "owner-settings" };
  }

  return { handled: false, reply: null, flow: "owner-unhandled" };
}
