// Client-side helpers for the GoodDollar face verification flow.
// ethers is loaded lazily so the SSR worker bundle doesn't choke on its
// CJS/ESM interop at module init (`Class extends value [object Module]`).
//
// Payload shape mirrors the official @goodsdks/citizen-sdk `generateFVLink`
// (packages/citizen-sdk/src/sdks/viem-identity-sdk.ts): the goodid app now
// expects { account, nonce, fvsig, chain } plus a callback URL (`rdu` for
// redirect mode, `cbu` for popup mode). Missing the callback URL is what makes
// goodid.gooddollar.org bounce to /FVFlowError → "Login information is missing".

const FV_IDENTIFIER_MSG2 = `Sign this message to request verifying your account <account> and to create your own secret unique identifier for your anonymized record.
You can use this identifier in the future to delete this anonymized record.
WARNING: do not sign this message unless you trust the website/application requesting this signature.`;

const IDENTITY_URL = "https://goodid.gooddollar.org";
const CELO_RPC = "https://forno.celo.org";
const GD_IDENTITY_ADDRESS = "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42";
const GD_IDENTITY_ABI = ["function isWhitelisted(address account) view returns (bool)"];

export async function buildVerifyUrl(
  privateKey: string,
  _displayName?: string,
  callbackUrl?: string,
): Promise<{ url: string; address: string }> {
  const { ethers } = await import("ethers");
  const { compressToEncodedURIComponent } = await import("lz-string");
  const wallet = new ethers.Wallet(privateKey);
  const address = wallet.address;
  const nonce = Math.floor(Date.now() / 1000).toString();
  const fvSig = await wallet.signMessage(FV_IDENTIFIER_MSG2.replace("<account>", address));
  const rdu =
    callbackUrl ??
    (typeof window !== "undefined" ? `${window.location.origin}/home` : "https://good-app2.lovable.app/home");
  const params: Record<string, string | number> = {
    account: address,
    nonce,
    fvsig: fvSig,
    chain: 42220,
    rdu,
  };
  const url = new URL(IDENTITY_URL);
  url.searchParams.append("lz", compressToEncodedURIComponent(JSON.stringify(params)));
  return { url: url.toString(), address };
}


export async function generateNewIdentity(displayName: string) {
  const { ethers } = await import("ethers");
  const wallet = ethers.Wallet.createRandom();
  const { url, address } = await buildVerifyUrl(wallet.privateKey, displayName);
  return { privateKey: wallet.privateKey, address, verifyUrl: url };
}

export async function isWhitelisted(address: string): Promise<boolean> {
  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(CELO_RPC);
    const contract = new ethers.Contract(GD_IDENTITY_ADDRESS, GD_IDENTITY_ABI, provider);
    return await contract.isWhitelisted(address);
  } catch (e) {
    console.error("isWhitelisted failed:", e);
    return false;
  }
}
