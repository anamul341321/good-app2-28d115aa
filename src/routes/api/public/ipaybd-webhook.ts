import { createFileRoute } from "@tanstack/react-router";

/**
 * iPayBD payout webhook. Signature is an HMAC-SHA256 of the raw body using the
 * secret key, so we verify before touching any withdrawal row.
 */
export const Route = createFileRoute("/api/public/ipaybd-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature =
          request.headers.get("x-ipaybd-signature") ??
          request.headers.get("x-signature") ??
          request.headers.get("signature");

        const { ipaybdVerifySignature } = await import("@/lib/ipaybd.server");
        const valid = await ipaybdVerifySignature(raw, signature);
        if (!valid) return new Response("Invalid signature", { status: 401 });

        let body: any = null;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const d = body?.data ?? body ?? {};
        const withdrawId = String(d.withdraw_id ?? d.withdrawId ?? "");
        const status = String(d.status ?? "").toLowerCase();
        const detail = String(d.msg ?? d.message ?? "");
        if (!withdrawId || !status) return new Response("Missing fields", { status: 400 });

        const { applyPayoutResult } = await import("@/lib/payout.server");
        await applyPayoutResult({
          withdrawId,
          success: status === "success" || status === "completed" || status === "paid",
          detail,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
