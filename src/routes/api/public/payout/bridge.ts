/**
 * Phone-automation bridge (MacroDroid / Tasker) for withdraw payouts.
 *
 *   GET  /api/public/payout/bridge?key=...            → oldest pending payout
 *   POST /api/public/payout/bridge  { key, action }
 *        action=paid { id }                            → mark paid
 *        action=reject { id, reason? }                 → cancel + refund
 *        action=sms  { text }                          → parse bKash/Nagad
 *                                                        success SMS and auto
 *                                                        mark the match paid
 *
 * The key is derived from the bot token (same trick as the webhook secret), so
 * no new secret is needed and it can never be guessed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";

function bridgeKey(): string | null {
  const token = process.env["TG_MOD_BOT_TOKEN"] || process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return null;
  return createHash("sha256").update(`good-app-payout-bridge:${token}`).digest("base64url");
}

function authed(supplied: string | null): boolean {
  const key = bridgeKey();
  if (!key || !supplied) return false;
  if (supplied.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ supplied.charCodeAt(i);
  return diff === 0;
}

function digits(s: string) {
  return String(s ?? "").replace(/\D/g, "");
}

async function nextPending() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data } = await db
    .from("withdrawals")
    .select("id, user_id, amount, provider, wallet_number, created_at")
    .eq("status", "pending")
    .in("provider", ["bkash", "nagad"])
    .order("created_at", { ascending: true })
    .limit(1);
  const w = (data ?? [])[0] as any;
  if (!w) return null;
  const { data: p } = await db.from("profiles").select("uid_seq, display_name, kyc_verified").eq("id", w.user_id).maybeSingle();
  return {
    id: String(w.id),
    amount: Math.floor(Number(w.amount)),
    provider: String(w.provider),
    number: String(w.wallet_number ?? ""),
    uid: (p as any)?.uid_seq ?? null,
    name: (p as any)?.display_name ?? null,
    kyc: Boolean((p as any)?.kyc_verified),
    created_at: w.created_at,
  };
}

/** bKash/Nagad success SMS → { amount, number } */
function parseSms(text: string) {
  const t = String(text ?? "");
  const amt = /(?:Tk|BDT|৳)\s*([\d,]+(?:\.\d+)?)/i.exec(t) ?? /([\d,]+(?:\.\d+)?)\s*(?:Tk|BDT|৳)/i.exec(t);
  const num = /\b(01\d{9})\b/.exec(t.replace(/[^\d\s+]/g, " "));
  const ok = /success|successful|sent|complete|received|হয়েছে|সফল|পাঠানো/i.test(t);
  const trx = /(?:TrxID|Trx ID|TrxId|TxnID)[:\s]*([A-Z0-9]{6,})/i.exec(t);
  return {
    ok,
    amount: amt ? Number(String(amt[1]).replace(/,/g, "")) : null,
    number: num ? num[1] : null,
    trxid: trx ? trx[1] : null,
  };
}

export const Route = createFileRoute("/api/public/payout/bridge")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (!authed(url.searchParams.get("key"))) return new Response("unauthorized", { status: 401 });
        const next = await nextPending();
        if (!next) return Response.json({ ok: true, empty: true });
        return Response.json({ ok: true, empty: false, ...next });
      },

      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as any;
        const url = new URL(request.url);
        if (!authed(body?.key ?? url.searchParams.get("key"))) return new Response("unauthorized", { status: 401 });

        const { processWithdrawalFast } = await import("@/lib/withdraw-process.server");
        const action = String(body?.action ?? "").toLowerCase();

        if (action === "paid" && body?.id) {
          const res = await processWithdrawalFast({ id: String(body.id), action: "paid", by: "anamul (auto)" });
          return Response.json(res);
        }

        if (action === "reject" && body?.id) {
          const res = await processWithdrawalFast({
            id: String(body.id),
            action: "rejected",
            by: "anamul (auto)",
            reason: String(body?.reason ?? "পেমেন্ট করা যায়নি — টাকা ব্যালেন্সে ফেরত দেওয়া হয়েছে"),
          });
          return Response.json(res);
        }

        // "sms" = bKash/Nagad SMS text · "notification" = bKash/Nagad app push
        // notification text (the app itself sends no SMS, so MacroDroid reads the
        // notification instead — no success keyword required there).
        if (action === "sms" || action === "notification" || action === "notif") {
          const lenient = action !== "sms";
          const sms = parseSms(String(body?.text ?? ""));
          if ((!sms.ok && !lenient) || !sms.amount || !sms.number) {
            return Response.json({ ok: false, message: "SMS বোঝা যায়নি", parsed: sms });
          }
          const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
          const { data: rows } = await db
            .from("withdrawals")
            .select("id, amount, wallet_number")
            .eq("status", "pending")
            .order("created_at", { ascending: true })
            .limit(200);
          const target = (rows ?? []).find(
            (w: any) =>
              digits(w.wallet_number).slice(-11) === digits(sms.number!).slice(-11) &&
              Math.abs(Math.floor(Number(w.amount)) - Math.floor(sms.amount!)) <= 1,
          ) as any;
          if (!target) return Response.json({ ok: false, message: "মিল পাওয়া যায়নি", parsed: sms });

          const res = await processWithdrawalFast({
            id: String(target.id),
            action: "paid",
            by: "anamul (auto SMS)",
          });
          if (res.ok && sms.trxid) {
            await db.from("withdrawals").update({ payout_trxid: sms.trxid, payout_provider: "manual-sms" } as any).eq("id", target.id);
          }
          try {
            const { alertAdminPrivate } = await import("@/lib/telegram-alert.server");
            if (res.ok) {
              await alertAdminPrivate(
                `🤖 <b>অটো paid</b> — ${Math.floor(sms.amount)}৳ · <code>${sms.number}</code>${sms.trxid ? ` · TrxID ${sms.trxid}` : ""}`,
              );
            }
          } catch {
            /* alert failure must not break the bridge */
          }
          return Response.json({ ...res, id: String(target.id), parsed: sms });
        }

        return Response.json({ ok: false, message: "unknown action" }, { status: 400 });
      },
    },
  },
});
