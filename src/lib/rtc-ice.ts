import { getTurnServers } from "./turn.functions";

/** দ্রুত relay সার্ভার একবার এনে সব কলের কনফিগের সামনে বসিয়ে দেয়। */
let fetched: RTCIceServer[] | null = null;
let loading: Promise<RTCIceServer[]> | null = null;
const targets: RTCConfiguration[] = [];

function apply(t: RTCConfiguration) {
  if (fetched?.length) t.iceServers = [...fetched, ...(t.iceServers ?? [])];
}

export function registerFastIce(cfg: RTCConfiguration) {
  if (typeof window === "undefined" || targets.includes(cfg)) return;
  targets.push(cfg);
  if (fetched) { apply(cfg); return; }
  if (loading) return;
  loading = getTurnServers()
    .then(({ iceServers }) => {
      fetched = iceServers;
      targets.forEach(apply);
      return iceServers;
    })
    .catch(() => {
      loading = null;
      return [];
    });
}

/** Relay তথ্য অল্প সময়ের মধ্যে এলে সেটি নিয়েই peer connection বানায়। */
export async function waitForFastIce(cfg: RTCConfiguration, maxWaitMs = 900) {
  registerFastIce(cfg);
  if (!loading || fetched) return cfg;
  await Promise.race([
    loading,
    new Promise<RTCIceServer[]>((resolve) => window.setTimeout(() => resolve([]), maxWaitMs)),
  ]);
  return cfg;
}
