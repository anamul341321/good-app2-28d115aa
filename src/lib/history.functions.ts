import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HistoryKind = "recharge" | "card" | "withdraw" | "transfer_in" | "transfer_out";

export type HistoryItem = {
  id: string;
  kind: HistoryKind;
  title: string;
  subtitle: string | null;
  amount: number;
  fee: number;
  total: number;
  status: "success" | "pending" | "failed";
  status_label: string;
  ref: string | null;
  created_at: string;
};

/** Unified money history: recharge, card purchase, withdraw, send/receive. */
export const getMyHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const sb = context.supabase;

    const [rech, cards, wd, tr] = await Promise.all([
      sb.from("recharges")
        .select("id, mobile, operator, connection_type, amount, fee_amount, total_deducted, status, provider_ref, error_message, created_at")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
      sb.from("card_codes")
        .select("id, code, used_at, card_products(name, operator, card_type, amount_label, selling_price, validity)")
        .eq("used_by", uid).order("used_at", { ascending: false }).limit(200),
      sb.from("withdrawals")
        .select("id, amount, provider, wallet_number, status, reject_reason, payout_trxid, created_at, processed_at")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
      sb.from("transfers")
        .select("id, sender_id, receiver_id, amount, fee_amount, note, created_at")
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
        .order("created_at", { ascending: false }).limit(200),
    ]);

    const items: HistoryItem[] = [];

    for (const r of rech.data ?? []) {
      const amount = Math.floor(Number(r.amount ?? 0));
      const fee = Math.floor(Number(r.fee_amount ?? 0));
      items.push({
        id: `rech-${r.id}`,
        kind: "recharge",
        title: `${r.mobile} · ${String(r.operator ?? "").toUpperCase()}`,
        subtitle: r.status === "failed" ? (r.error_message ?? null) : (r.connection_type ?? null),
        amount,
        fee,
        total: Math.floor(Number(r.total_deducted ?? amount + fee)),
        status: r.status === "success" ? "success" : r.status === "failed" ? "failed" : "pending",
        status_label: String(r.status ?? ""),
        ref: r.provider_ref ?? null,
        created_at: r.created_at,
      });
    }

    for (const c of (cards.data ?? []) as any[]) {
      const p = c.card_products ?? {};
      const price = Math.floor(Number(p.selling_price ?? 0));
      items.push({
        id: `card-${c.id}`,
        kind: "card",
        title: `${p.operator ?? "Card"} · ${p.amount_label ?? p.name ?? ""}`,
        subtitle: [p.card_type, p.validity].filter(Boolean).join(" · ") || null,
        amount: price,
        fee: 0,
        total: price,
        status: "success",
        status_label: "purchased",
        ref: c.code ?? null,
        created_at: c.used_at ?? new Date().toISOString(),
      });
    }

    for (const w of (wd.data ?? []) as any[]) {
      const amount = Math.floor(Number(w.amount ?? 0));
      items.push({
        id: `wd-${w.id}`,
        kind: "withdraw",
        title: `${String(w.provider ?? "").toUpperCase()} · ${w.wallet_number ?? ""}`,
        subtitle: w.status === "rejected" ? (w.reject_reason ?? null) : null,
        amount,
        fee: 0,
        total: amount,
        status: w.status === "paid" ? "success" : w.status === "rejected" ? "failed" : "pending",
        status_label: String(w.status ?? ""),
        ref: w.payout_trxid ?? null,
        created_at: w.created_at,
      });
    }

    for (const t of (tr.data ?? []) as any[]) {
      const out = t.sender_id === uid;
      const amount = Math.floor(Number(t.amount ?? 0));
      const fee = Math.floor(Number(t.fee_amount ?? 0));
      items.push({
        id: `tr-${t.id}`,
        kind: out ? "transfer_out" : "transfer_in",
        title: out ? "Send Money" : "Received",
        subtitle: t.note ?? null,
        amount,
        fee: out ? fee : 0,
        total: out ? amount + fee : amount,
        status: "success",
        status_label: out ? "sent" : "received",
        ref: null,
        created_at: t.created_at,
      });
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items.slice(0, 400);
  });
