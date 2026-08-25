// Blockchain audit for verification wallets.
//
// Goal: find "fresh" wallets — no outgoing transaction at all (no G$/token
// transfer out, no CELO out) and no incoming CELO/token from an outside
// wallet (GoodDollar faucet / UBI system addresses excluded).
//
// nonce  -> cheap RPC check, catches every outgoing tx (token or native).
// blockscout -> inbound native + token transfers, so we can see who funded it.

const RPC = "https://forno.celo.org";
const BLOCKSCOUT = "https://celo.blockscout.com/api";

// Known GoodDollar / Celo system senders (faucet, UBI scheme, identity, bridge).
// Lowercase.
const SYSTEM_SENDERS = new Set<string>([
  "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a", // GoodDollar faucet
  "0xc361a6e67822a0edc17d899227dd9fc50bd62f42", // Identity
  "0x43d72ff17701b2da814620735c39c620ce0ea4a1", // G$ token (celo)
  "0x03d3dab843e6c03b3d271eff9178neverusedplaceholder",
]);

// A sender seen funding this many of our wallets is a faucet/system address,
// not "another wallet of ours".
const SYSTEM_FREQ_THRESHOLD = 25;

type ScanRow = {
  wallet_address: string;
  nonce: number;
  token_out_count: number;
  token_in_count: number;
  in_senders: string[];
};

async function rpcNonces(addrs: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const CHUNK = 50;
  for (let i = 0; i < addrs.length; i += CHUNK) {
    const slice = addrs.slice(i, i + CHUNK);
    const body = slice.map((a, idx) => ({
      jsonrpc: "2.0",
      id: idx,
      method: "eth_getTransactionCount",
      params: [a, "latest"],
    }));
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`RPC ${res.status}`);
    const json: any = await res.json();
    const list: any[] = Array.isArray(json) ? json : [json];
    for (const item of list) {
      const addr = slice[item?.id ?? 0];
      if (!addr) continue;
      const n = typeof item?.result === "string" ? parseInt(item.result, 16) : 0;
      out.set(addr.toLowerCase(), Number.isFinite(n) ? n : 0);
    }
  }
  return out;
}

async function blockscout(action: string, address: string): Promise<any[]> {
  const url = `${BLOCKSCOUT}?module=account&action=${action}&address=${address}&page=1&offset=100&sort=asc`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json: any = await res.json();
    return Array.isArray(json?.result) ? json.result : [];
  } catch {
    return [];
  }
}

async function scanOne(address: string, nonce: number): Promise<ScanRow> {
  const lower = address.toLowerCase();
  const [native, tokens] = await Promise.all([
    blockscout("txlist", address),
    blockscout("tokentx", address),
  ]);

  const senders = new Set<string>();
  let tokenOut = 0;
  let tokenIn = 0;

  for (const tx of native) {
    const from = String(tx?.from ?? "").toLowerCase();
    const to = String(tx?.to ?? "").toLowerCase();
    const value = String(tx?.value ?? "0");
    if (to === lower && from !== lower && value !== "0") senders.add(from);
  }
  for (const tx of tokens) {
    const from = String(tx?.from ?? "").toLowerCase();
    const to = String(tx?.to ?? "").toLowerCase();
    if (from === lower) tokenOut += 1;
    else if (to === lower) {
      tokenIn += 1;
      senders.add(from);
    }
  }

  return {
    wallet_address: address,
    nonce,
    token_out_count: tokenOut,
    token_in_count: tokenIn,
    in_senders: [...senders],
  };
}

/** Scan a batch of wallet addresses and persist raw on-chain facts. */
export async function scanWallets(addresses: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nonces = await rpcNonces(addresses);

  const rows: ScanRow[] = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < addresses.length; i += CONCURRENCY) {
    const slice = addresses.slice(i, i + CONCURRENCY);
    const done = await Promise.all(
      slice.map((a) => scanOne(a, nonces.get(a.toLowerCase()) ?? 0)),
    );
    rows.push(...done);
  }

  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from("wallet_onchain_scan").upsert(
      rows.map((r) => ({
        wallet_address: r.wallet_address,
        nonce: r.nonce,
        token_out_count: r.token_out_count,
        token_in_count: r.token_in_count,
        in_senders: r.in_senders,
        // provisional; recomputePristine() finalises using sender frequency
        celo_in_external: false,
        pristine: r.nonce === 0 && r.token_out_count === 0,
        scanned_at: new Date().toISOString(),
      })),
      { onConflict: "wallet_address" },
    );
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

/**
 * Second pass: classify inbound senders. Any sender that funded many of our
 * wallets is a faucet/system address; the rest count as "outside wallet".
 */
export async function recomputePristine() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("wallet_onchain_scan")
      .select("wallet_address, nonce, token_out_count, in_senders")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const freq = new Map<string, number>();
  for (const r of all) {
    for (const s of (r.in_senders as string[]) ?? []) {
      freq.set(s, (freq.get(s) ?? 0) + 1);
    }
  }
  const isSystem = (s: string) =>
    SYSTEM_SENDERS.has(s) || (freq.get(s) ?? 0) >= SYSTEM_FREQ_THRESHOLD;

  let pristineCount = 0;
  const updates = all.map((r) => {
    const senders = ((r.in_senders as string[]) ?? []).filter((s) => !isSystem(s));
    const external = senders.length > 0;
    const pristine = r.nonce === 0 && r.token_out_count === 0 && !external;
    if (pristine) pristineCount += 1;
    return {
      wallet_address: r.wallet_address,
      celo_in_external: external,
      pristine,
    };
  });

  const CHUNK = 500;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const { error } = await supabaseAdmin
      .from("wallet_onchain_scan")
      .upsert(updates.slice(i, i + CHUNK), { onConflict: "wallet_address" });
    if (error) throw new Error(error.message);
  }
  return { scanned: all.length, pristine: pristineCount };
}
