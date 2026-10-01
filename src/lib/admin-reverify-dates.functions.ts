import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RPC = "https://forno.celo.org";
const IDENTITY = "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42";
const SEL_LAST = "0xe1e360ba"; // lastAuthenticated(address)
const SEL_PERIOD = "0x31b376e2"; // authenticationPeriod()

async function call(data: string): Promise<bigint | null> {
  try {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: IDENTITY, data }, "latest"] }),
    });
    const j: any = await r.json();
    if (!j?.result || j.result === "0x") return null;
    return BigInt(j.result);
  } catch {
    return null;
  }
}

/** Admin only: exact on-chain next re-verify date for each slot wallet. */
export const adminSlotReverifyDates = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("@/lib/admin-session.server");
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tasks } = await supabaseAdmin
      .from("tasks").select("id, wallet_address").eq("user_id", data.userId);
    const periodRaw = await call(SEL_PERIOD);
    const periodDays = periodRaw ? Number(periodRaw) : 180;
    const out: Record<string, { lastAuth: string | null; dueAt: string | null }> = {};
    await Promise.all((tasks ?? []).filter((t) => /^0x[0-9a-fA-F]{40}$/.test(t.wallet_address ?? "")).map(async (t) => {
      const pad = "000000000000000000000000" + t.wallet_address!.toLowerCase().slice(2);
      const last = await call(SEL_LAST + pad);
      if (!last || last === 0n) { out[t.id] = { lastAuth: null, dueAt: null }; return; }
      const ms = Number(last) * 1000;
      out[t.id] = { lastAuth: new Date(ms).toISOString(), dueAt: new Date(ms + periodDays * 86400000).toISOString() };
    }));
    return { periodDays, slots: out };
  });
