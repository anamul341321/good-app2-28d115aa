// Server-safe Good-App whitelist check via raw JSON-RPC (no ethers).
// Avoids the "Class extends value [object Module]" crash from importing
// ethers dynamically inside the Cloudflare Worker runtime.
const CELO_RPC = "https://forno.celo.org";
const GD_IDENTITY_ADDRESS = "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42";
// keccak256("isWhitelisted(address)").slice(0,4)
const SELECTOR = "0x3af32abf";

function padAddress(addr: string): string {
  const clean = addr.toLowerCase().replace(/^0x/, "");
  if (clean.length !== 40) throw new Error("bad address");
  return "000000000000000000000000" + clean;
}

export async function isWhitelistedRPC(addr: string): Promise<boolean> {
  const data = SELECTOR + padAddress(addr);
  const res = await fetch(CELO_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: GD_IDENTITY_ADDRESS, data }, "latest"],
    }),
  });
  if (!res.ok) throw new Error(`Good-App check failed (${res.status})`);
  const j: any = await res.json();
  if (j?.error) throw new Error(j.error.message ?? "Good-App check failed");
  if (!j?.result || typeof j.result !== "string") throw new Error("Good-App response invalid");
  // Bool result = 32-byte hex; non-zero last byte = true.
  return /[1-9a-f]/i.test(j.result.slice(2));
}
