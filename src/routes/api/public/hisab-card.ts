/**
 * Public (token-signed) HTML card of a user's step-by-step earnings hisab.
 *
 * The Telegram bot turns this page into an image so users can get their full
 * hisab as a picture instead of a long wall of text. The link is signed and
 * short-lived, so nobody can read someone else's hisab by guessing a UID.
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { currentHisabBucket, signHisab } from "@/lib/telegram-hisab.server";

function verify(uid: string, token: string): boolean {
  const now = currentHisabBucket();
  return [now, now - 1].some((b) => {
    const want = Buffer.from(signHisab(uid, b));
    const got = Buffer.from(token);
    return want.length === got.length && timingSafeEqual(want, got);
  });
}


const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const bdt = (n: number) => `${Number(n || 0).toFixed(2)}৳`;

export const Route = createFileRoute("/api/public/hisab-card")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const uid = (url.searchParams.get("uid") || "").replace(/\D/g, "");
        const token = url.searchParams.get("t") || "";
        if (!uid || !verify(uid, token)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("id, uid_seq, display_name")
          .eq("uid_seq", Number(uid))
          .maybeSingle();
        if (!prof?.id) return new Response("Not found", { status: 404 });

        const { buildEarningsBreakdown } = await import("@/lib/earnings-breakdown.server");
        const b = await buildEarningsBreakdown(supabaseAdmin, (prof as any).id);
        const m = b.mining;

        const row = (label: string, formula: string | null | undefined, amount: number) => `
          <div class="row">
            <div><div class="lbl">${esc(label)}</div>${
              formula ? `<div class="frm">${esc(formula)}</div>` : ""
            }</div>
            <div class="amt">${bdt(amount)}</div>
          </div>`;

        const html = `<!doctype html>
<html lang="bn"><head><meta charset="utf-8" />
<title>হিসাব — UID ${esc((prof as any).uid_seq)}</title>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#0b1020;font-family:'Hind Siliguri',system-ui,sans-serif;padding:28px}
  .card{width:840px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}
  .head{background:linear-gradient(135deg,#0f766e,#0891b2);color:#fff;padding:26px 30px}
  .head h1{margin:0;font-size:30px;font-weight:700}
  .head p{margin:6px 0 0;font-size:18px;opacity:.9}
  .sec{padding:20px 30px 6px}
  .sec h2{margin:0 0 10px;font-size:22px;color:#0f172a;display:flex;justify-content:space-between}
  .sec h2 span{color:#0f766e}
  .row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px dashed #e2e8f0}
  .lbl{font-size:17px;color:#1e293b}
  .frm{font-size:14px;color:#64748b;margin-top:2px}
  .amt{font-size:18px;font-weight:700;color:#0f172a;white-space:nowrap}
  .total{margin:18px 30px 26px;background:#ecfdf5;border:2px solid #10b981;border-radius:16px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
  .total b{font-size:22px;color:#065f46}
  .total i{font-style:normal;font-size:26px;font-weight:700;color:#065f46}
  .foot{padding:0 30px 24px;color:#94a3b8;font-size:14px;text-align:center}
</style></head>
<body><div class="card">
  <div class="head">
    <h1>🧾 ${esc((prof as any).display_name || "ইউজার")} — ধাপে ধাপে হিসাব</h1>
    <p>UID ${esc((prof as any).uid_seq)} · ${new Date().toLocaleDateString("bn-BD")}</p>
  </div>
  <div class="sec">
    <h2>🎁 বোনাস <span>${bdt(b.bonus.total)}</span></h2>
    ${b.bonus.steps.map((s) => row(s.label, s.formula, s.amount)).join("") ||
      `<div class="row"><div class="lbl">এখনো কোনো বোনাস যোগ হয়নি</div><div class="amt">0.00৳</div></div>`}
  </div>
  <div class="sec">
    <h2>⛏️ মাইনিং <span>${bdt(m.total)}</span></h2>
    ${m.steps.map((s) => row(s.label, s.formula, s.amount)).join("")}
  </div>
  <div class="total"><b>💰 সব মিলিয়ে</b><i>${bdt(b.bonus.total + m.total)}</i></div>
  <div class="foot">Good-App · এই হিসাব অ্যাপের Earnings পেজ থেকেও ডাউনলোড করা যায়</div>
</div></body></html>`;

        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
