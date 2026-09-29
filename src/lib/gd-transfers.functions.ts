import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RPC = "https://forno.celo.org";
const GD = "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const CHUNK = 5000;

async function rpc(method: string, params: unknown[]): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j: any = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((res) => setTimeout(res, 500));
    }
  }
}

async function blockTs(n: number): Promise<number> {
  const b = await rpc("eth_getBlockByNumber", ["0x" + n.toString(16), false]);
  return parseInt(b.timestamp, 16);
}

/** First block with timestamp >= ts (binary search). */
async function blockAt(ts: number, latest: number): Promise<number> {
  let lo = 0;
  let hi = latest;
  // narrow start using ~1s block time guess
  const latestTs = await blockTs(latest);
  const guess = Math.max(0, latest - (latestTs - ts) - 20000);
  if ((await blockTs(guess)) < ts) lo = guess;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await blockTs(mid)) < ts) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** G$ sent out from our app wallets on a Dhaka-local date, grouped by receiver. */
export const adminGdTransfersForDay = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(i))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-session.server").catch(() => ({ requireAdminSession: null as any }));
    if (requireAdminSession) await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // our wallets
    const ours = new Set<string>();
    for (const table of ["tasks", "unverified_attempts"] as const) {
      for (let from = 0; ; from += 1000) {
        const { data: rows, error } = await supabaseAdmin
          .from(table)
          .select("wallet_address")
          .not("wallet_address", "is", null)
          .range(from, from + 999);
        if (error) throw new Error(error.message);
        (rows ?? []).forEach((r: any) => r.wallet_address && ours.add(String(r.wallet_address).toLowerCase()));
        if (!rows || rows.length < 1000) break;
      }
    }

    const startTs = Math.floor(new Date(`${data.date}T00:00:00+06:00`).getTime() / 1000);
    const endTs = startTs + 86400;
    const latest = parseInt(await rpc("eth_blockNumber", []), 16);
    const latestTs = await blockTs(latest);
    if (startTs > latestTs) return { date: data.date, total: 0, count: 0, wallets: 0, receivers: [], walletsTracked: ours.size };
    const fromBlock = await blockAt(startTs, latest);
    const toBlock = endTs > latestTs ? latest : (await blockAt(endTs, latest)) - 1;

    const ranges: [number, number][] = [];
    for (let b = fromBlock; b <= toBlock; b += CHUNK) ranges.push([b, Math.min(b + CHUNK - 1, toBlock)]);

    const byTo = new Map<string, { total: bigint; count: number; senders: Set<string> }>();
    const senders = new Set<string>();
    let grand = 0n;
    let count = 0;

    for (let i = 0; i < ranges.length; i += 4) {
      const batch = ranges.slice(i, i + 4);
      const results = await Promise.all(
        batch.map(([f, t]) =>
          rpc("eth_getLogs", [{ fromBlock: "0x" + f.toString(16), toBlock: "0x" + t.toString(16), address: GD, topics: [TRANSFER_TOPIC] }]),
        ),
      );
      for (const logs of results) {
        for (const l of logs as any[]) {
          const from = "0x" + String(l.topics[1]).slice(26).toLowerCase();
          if (!ours.has(from)) continue;
          const to = "0x" + String(l.topics[2]).slice(26).toLowerCase();
          const amt = BigInt(l.data);
          grand += amt;
          count++;
          senders.add(from);
          const e = byTo.get(to) ?? { total: 0n, count: 0, senders: new Set<string>() };
          e.total += amt;
          e.count++;
          e.senders.add(from);
          byTo.set(to, e);
        }
      }
    }

    const toNum = (v: bigint) => Number(v / 10n ** 14n) / 10000; // G$ has 18 decimals
    const receivers = [...byTo.entries()]
      .map(([address, e]) => ({ address, total: toNum(e.total), count: e.count, wallets: e.senders.size }))
      .sort((a, b) => b.total - a.total);

    return { date: data.date, total: toNum(grand), count, wallets: senders.size, receivers, walletsTracked: ours.size };
  });
