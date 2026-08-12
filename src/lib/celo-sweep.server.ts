// Server-only: sweep native CELO from many private keys into one address.
// Runs fully on the server (works even if the admin's phone/data is offline),
// with high concurrency + retries so it is fast and resilient.
import { createWalletClient, createPublicClient, http, formatEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const RPC = "https://forno.celo.org";
const GAS_LIMIT = 21_000n;

const publicClient = createPublicClient({ chain: celo, transport: http(RPC, { timeout: 20_000, retryCount: 2 }) });

function normKey(k: string): Hex {
  const t = k.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(t)) throw new Error("invalid private key");
  return `0x${t}` as Hex;
}

export type SweepResult = {
  address: string;
  status: "sent" | "empty" | "dust" | "failed";
  amount?: string;
  balance?: string;
  hash?: string;
  error?: string;
};

async function sweepOne(key: string, to: Hex): Promise<SweepResult> {
  const account = privateKeyToAccount(normKey(key));
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) return { address: account.address, status: "empty", amount: "0", balance: "0" };

  const gasPrice = await publicClient.getGasPrice();
  // small pad so the tx lands without eating too much of a dust balance
  const maxFee = (gasPrice * 12n) / 10n + 1n;
  const cost = maxFee * GAS_LIMIT;
  if (balance <= cost) {
    return {
      address: account.address,
      status: "dust",
      amount: "0",
      balance: formatEther(balance),
      error: `gas fee (${formatEther(cost)}) > balance`,
    };
  }

  const value = balance - cost;
  const wallet = createWalletClient({ account, chain: celo, transport: http(RPC, { timeout: 20_000, retryCount: 2 }) });
  const hash = await wallet.sendTransaction({
    to,
    value,
    gas: GAS_LIMIT,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: maxFee / 2n,
  });
  return { address: account.address, status: "sent", amount: formatEther(value), hash };
}

/** Sweep a list of keys with concurrency + one automatic retry per failure. */
export async function sweepCeloKeys(keys: string[], to: string, concurrency = 10): Promise<SweepResult[]> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to.trim())) throw new Error("সঠিক receive address দিন (0x...)");
  const target = to.trim() as Hex;
  const out: SweepResult[] = [];
  let i = 0;

  const worker = async () => {
    for (;;) {
      const idx = i++;
      if (idx >= keys.length) return;
      const key = keys[idx]!;
      let last = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          out.push(await sweepOne(key, target));
          last = "";
          break;
        } catch (e: any) {
          last = e?.shortMessage ?? e?.message ?? "unknown error";
          if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
        }
      }
      if (last) {
        let addr = "?";
        try { addr = privateKeyToAccount(normKey(key)).address; } catch {}
        out.push({ address: addr, status: "failed", error: last });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, worker));
  return out;
}
