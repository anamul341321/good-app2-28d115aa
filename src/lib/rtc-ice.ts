import { getTurnServers } from "./turn.functions";

/** সব কলের relay সার্ভার একবার এনে দেওয়া কনফিগগুলোর সামনে বসিয়ে দেয়। */
let loaded: Promise<void> | null = null;
const targets: RTCConfiguration[] = [];

export function useFastIce(cfg: RTCConfiguration) {
  if (!targets.includes(cfg)) targets.push(cfg);
  if (typeof window === "undefined") return;
  if (!loaded) {
    loaded = getTurnServers()
      .then(({ iceServers }) => {
        if (!iceServers.length) return;
        targets.forEach((t) => { t.iceServers = [...iceServers, ...(t.iceServers ?? [])]; });
      })
      .catch(() => { loaded = null; });
  } else {
    void loaded;
  }
}
