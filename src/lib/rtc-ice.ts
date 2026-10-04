import { getTurnServers } from "./turn.functions";

/** দ্রুত relay সার্ভার একবার এনে সব কলের কনফিগের সামনে বসিয়ে দেয়। */
let fetched: RTCIceServer[] | null = null;
let loading = false;
const targets: RTCConfiguration[] = [];

function apply(t: RTCConfiguration) {
  if (fetched?.length) t.iceServers = [...fetched, ...(t.iceServers ?? [])];
}

export function registerFastIce(cfg: RTCConfiguration) {
  if (typeof window === "undefined" || targets.includes(cfg)) return;
  targets.push(cfg);
  if (fetched) { apply(cfg); return; }
  if (loading) return;
  loading = true;
  void getTurnServers()
    .then(({ iceServers }) => { fetched = iceServers; targets.forEach(apply); })
    .catch(() => { loading = false; });
}
