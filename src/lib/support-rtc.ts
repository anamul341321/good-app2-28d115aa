import { registerFastIce } from "./rtc-ice";
// কাস্টমার কেয়ার লাইভ কলের শেয়ার করা সেটিংস (ব্রাউজার-সেফ)
export const SUPPORT_LOBBY = "support-call-lobby";
export const supportChannel = (id: string) => `support-call-${id}`;

export const SUPPORT_ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

registerFastIce(SUPPORT_ICE);

export type RingPayload = { id: string; name: string | null; uid: number | null; at: number };
