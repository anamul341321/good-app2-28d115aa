/**
 * iPayBD auto payout (MFS withdraw) client — server only.
 *
 * Docs: https://ipaybd.net/develop_docs/withdraw-api
 *  POST https://ipaybd.net/api/v1/mfs/create
 *  headers: X-Authorization: <public key>, X-Authorization-Secret: <secret key>
 *  body: { amount, mfs_operator, cust_number, withdraw_id, webhook_url }
 *  immediate response is only an acknowledgement ({ status, trxid });
 *  the final result arrives on our webhook (success | rejected).
 */
const BASE = "https://ipaybd.net/api/v1";

export type MfsOperator = "bkash" | "nagad" | "rocket" | "upay";

function keys() {
  return {
    pub: process.env["IPAYBD_PUBLIC_KEY"] ?? "",
    secret: process.env["IPAYBD_SECRET_KEY"] ?? "",
  };
}

export function isIpaybdConfigured() {
  const { pub, secret } = keys();
  return Boolean(pub && secret);
}

function msgOf(json: any, fallback: string) {
  const m = json?.message ?? json?.msg ?? json?.error;
  return typeof m === "string" && m.trim() ? m : fallback;
}

export async function ipaybdCreateWithdraw(input: {
  amount: number;
  operator: MfsOperator;
  customerNumber: string;
  withdrawId: string;
  webhookUrl: string;
}) {
  const { pub, secret } = keys();
  if (!pub || !secret) {
    return { ok: false, trxid: null as string | null, message: "অটো পেমেন্ট কনফিগার করা নেই", raw: null as any };
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}/mfs/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Authorization": pub,
        "X-Authorization-Secret": secret,
      },
      body: JSON.stringify({
        amount: Math.floor(input.amount),
        mfs_operator: input.operator,
        cust_number: input.customerNumber,
        withdraw_id: input.withdrawId,
        webhook_url: input.webhookUrl,
      }),
    });
  } catch (e: any) {
    return { ok: false, trxid: null, message: `নেটওয়ার্ক সমস্যা: ${e?.message ?? e}`, raw: null };
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  const ok = res.ok && (json?.status === true || json?.status === "true" || json?.status === "success");
  const trxid =
    typeof json?.trxid === "string" ? json.trxid : typeof json?.data?.trxid === "string" ? json.data.trxid : null;

  return {
    ok,
    trxid,
    message: ok ? msgOf(json, "রিকোয়েস্ট পাঠানো হয়েছে") : msgOf(json, `পেমেন্ট রিকোয়েস্ট ব্যর্থ (HTTP ${res.status})`),
    raw: json,
  };
}

export async function ipaybdCheckStatus(trxid: string) {
  const { pub, secret } = keys();
  if (!pub || !secret) return null;
  try {
    const res = await fetch(`${BASE}/mfs/status/${encodeURIComponent(trxid)}`, {
      headers: {
        Accept: "application/json",
        "X-Authorization": pub,
        "X-Authorization-Secret": secret,
      },
    });
    return (await res.json()) as any;
  } catch {
    return null;
  }
}

/** Verify the HMAC-SHA256 webhook signature (raw body signed with the secret key). */
export async function ipaybdVerifySignature(rawBody: string, signature: string | null) {
  const { secret } = keys();
  if (!secret || !signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const got = signature.trim().replace(/^sha256=/i, "").toLowerCase();
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
