/**
 * অ্যাডমিন বটকে মেনশন করে অ্যাপের সেটিংস বদলাতে বললে (যেমন "নগদ withdraw বন্ধ
 * করে বিকাশ চালু করো") — এই ফাইলটা সেই নির্দেশ বুঝে আসল ডাটাবেজে পরিবর্তন
 * করে দেয় এবং গ্রুপে দেওয়ার মতো সুন্দর বাংলা ঘোষণা তৈরি করে।
 *
 * নিরাপত্তা: শুধু নিচের whitelisted অ্যাকশনগুলোই চালানো যায়। কল করার আগে
 * webhook অবশ্যই যাচাই করে যে মেসেজদাতা গ্রুপ-অ্যাডমিন/মালিক।
 */

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

export type AdminOp =
  | { action: "set_toggle"; field: ToggleField; value: boolean }
  | { action: "set_number"; field: NumberField; value: number }
  | { action: "set_off_message"; field: MessageField; value: string }
  | { action: "announcement"; value: string }
  | { action: "announcement_off" };

type ToggleField =
  | "bkash_enabled"
  | "nagad_enabled"
  | "usdt_enabled"
  | "recharge_enabled"
  | "first_verify_mining_mode"
  | "promo_active";

type NumberField = "first_verify_bonus" | "reverify_bonus" | "referrer_bonus" | "usdt_rate_bdt";
type MessageField = "bkash_off_message" | "nagad_off_message" | "usdt_off_message" | "recharge_off_message";

const TOGGLES: ToggleField[] = [
  "bkash_enabled",
  "nagad_enabled",
  "usdt_enabled",
  "recharge_enabled",
  "first_verify_mining_mode",
  "promo_active",
];
const NUMBERS: NumberField[] = ["first_verify_bonus", "reverify_bonus", "referrer_bonus", "usdt_rate_bdt"];
const MESSAGES: MessageField[] = [
  "bkash_off_message",
  "nagad_off_message",
  "usdt_off_message",
  "recharge_off_message",
];

const LABEL: Record<string, string> = {
  bkash_enabled: "বিকাশ উইথড্র",
  nagad_enabled: "নগদ উইথড্র",
  usdt_enabled: "USDT উইথড্র",
  recharge_enabled: "মোবাইল রিচার্জ",
  first_verify_mining_mode: "ফার্স্ট ভেরিফাই মাইনিং মোড",
  promo_active: "প্রোমো অফার",
  first_verify_bonus: "ফার্স্ট ভেরিফাই বোনাস",
  reverify_bonus: "রি-ভেরিফাই বোনাস",
  referrer_bonus: "রেফার বোনাস",
  usdt_rate_bdt: "USDT রেট (৳)",
};

const SCHEMA_HINT = `
সম্ভাব্য অ্যাকশন (শুধু এগুলোই):
1) {"action":"set_toggle","field":"<${TOGGLES.join("|")}>","value":true|false}
2) {"action":"set_number","field":"<${NUMBERS.join("|")}>","value":<সংখ্যা>}
3) {"action":"set_off_message","field":"<${MESSAGES.join("|")}>","value":"<বাংলা মেসেজ>"}
4) {"action":"announcement","value":"<অ্যাপের নোটিশ বক্সে দেখানোর বাংলা লেখা>"}
5) {"action":"announcement_off"}
`;

/** নির্দেশ থেকে চালানোর মতো অ্যাকশন বের করে (না বুঝলে খালি অ্যারে)। */
export async function interpretAdminOrder(order: string): Promise<AdminOp[]> {
  const key = process.env.LOVABLE_API_KEY;
  const q = (order || "").trim();
  if (!key || !q) return [];
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              `তুমি Good-App অ্যাডমিন কমান্ড পার্সার। অ্যাডমিনের বাংলা/বাংলিশ নির্দেশ পড়ে ` +
              `শুধু JSON দেবে: {"ops":[...]}\n${SCHEMA_HINT}\n` +
              `নিয়ম:\n• নির্দেশে অ্যাপের সেটিংস বদলানোর কথা না থাকলে {"ops":[]} দেবে।\n` +
              `• "নগদ বন্ধ করো" → nagad_enabled=false; "বিকাশ চালু করো" → bkash_enabled=true।\n` +
              `• একাধিক কাজ বললে একাধিক op দেবে।\n• JSON ছাড়া আর কিছু লিখবে না।`,
          },
          { role: "user", content: q },
        ],
      }),
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const raw = String(data.choices?.[0]?.message?.content ?? "");
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return [];
    const parsed = JSON.parse(json);
    const ops = Array.isArray(parsed?.ops) ? parsed.ops : [];
    return ops.filter(isValidOp).slice(0, 6);
  } catch {
    return [];
  }
}

function isValidOp(op: any): op is AdminOp {
  if (!op || typeof op !== "object") return false;
  if (op.action === "set_toggle") return TOGGLES.includes(op.field) && typeof op.value === "boolean";
  if (op.action === "set_number")
    return NUMBERS.includes(op.field) && typeof op.value === "number" && op.value >= 0 && op.value <= 100000;
  if (op.action === "set_off_message")
    return MESSAGES.includes(op.field) && typeof op.value === "string" && op.value.trim().length > 0;
  if (op.action === "announcement") return typeof op.value === "string" && op.value.trim().length > 2;
  if (op.action === "announcement_off") return true;
  return false;
}

/** অ্যাকশনগুলো আসলেই চালায় এবং কী কী হলো তার তালিকা ফেরত দেয়। */
export async function runAdminOps(ops: AdminOp[]): Promise<{ done: string[]; failed: string[] }> {
  const done: string[] = [];
  const failed: string[] = [];
  if (!ops.length) return { done, failed };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const patch: Record<string, unknown> = {};
  for (const op of ops) {
    if (op.action === "set_toggle") patch[op.field] = op.value;
    else if (op.action === "set_number") patch[op.field] = op.value;
    else if (op.action === "set_off_message") patch[op.field] = op.value.trim();
  }

  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin
      .from("bonus_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", "default");
    for (const op of ops) {
      if (op.action === "announcement" || op.action === "announcement_off") continue;
      const label = LABEL[(op as any).field] ?? (op as any).field;
      const text =
        op.action === "set_toggle"
          ? `${label} — ${op.value ? "✅ চালু" : "⛔ বন্ধ"}`
          : op.action === "set_number"
            ? `${label} — <b>${op.value}</b>`
            : `${label} বার্তা আপডেট`;
      (error ? failed : done).push(text);
    }
  }

  for (const op of ops) {
    if (op.action === "announcement") {
      const [{ error: offErr }, { error }] = await Promise.all([
        supabaseAdmin.from("announcements").update({ is_active: false }).eq("is_active", true),
        supabaseAdmin.from("announcements").insert({ message: op.value.trim(), is_active: true }),
      ]);
      (error || offErr ? failed : done).push("📢 নতুন নোটিশ চালু");
    } else if (op.action === "announcement_off") {
      const { error } = await supabaseAdmin.from("announcements").update({ is_active: false }).eq("is_active", true);
      (error ? failed : done).push("📢 নোটিশ বন্ধ");
    }
  }

  return { done, failed };
}

/** গ্রুপে পাঠানোর মতো সুন্দর ঘোষণা। */
export function opsAnnouncement(done: string[], failed: string[]): string {
  const lines: string[] = [];
  if (done.length) {
    lines.push(`✅ <b>অ্যাডমিনের নির্দেশে পরিবর্তন সম্পন্ন হয়েছে</b>`, "");
    for (const d of done) lines.push(`• ${d}`);
    lines.push("", `🔄 পরিবর্তনগুলো অ্যাপে <b>এখনই</b> কার্যকর হয়েছে — পেজটি রিফ্রেশ করে দেখে নিন।`);
  }
  if (failed.length) {
    if (lines.length) lines.push("");
    lines.push(`⚠️ <b>এই কাজগুলো করা যায়নি:</b>`);
    for (const f of failed) lines.push(`• ${f}`);
  }
  return lines.join("\n");
}
