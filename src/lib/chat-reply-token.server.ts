// ফোনের notification থেকে সরাসরি রিপ্লাই করার জন্য short-lived signed token।
// অ্যাপ না খুলেই মেসেজ পাঠানো যায়, কিন্তু টোকেন ছাড়া কেউ কিছু পাঠাতে পারবে না।
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_URL"] ?? "";
  return `chat-reply:${key}`;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createReplyToken(userId: string) {
  const exp = Date.now() + TTL_MS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyReplyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const payload = `${userId}.${exp}`;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!Number.isFinite(Number(exp)) || Number(exp) < Date.now()) return null;
  return userId;
}
