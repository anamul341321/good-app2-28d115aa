import { createServerFn } from "@tanstack/react-start";

/**
 * কল দ্রুত ও দুর্বল নেটে জোড়া লাগানোর জন্য Cloudflare-এর relay সার্ভারের
 * অস্থায়ী চাবি তৈরি করে। চাবি সেট না থাকলে খালি তালিকা ফেরত দেয়।
 */
export const getTurnServers = createServerFn({ method: "GET" }).handler(async () => {
  const id = process.env["CLOUDFLARE_TURN_KEY_ID"];
  const token = process.env["CLOUDFLARE_TURN_API_TOKEN"];
  if (!id || !token) return { iceServers: [] as RTCIceServer[] };
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 86400 }),
    });
    if (!r.ok) { console.error("turn creds", r.status, await r.text()); return { iceServers: [] as RTCIceServer[] }; }
    const j = (await r.json()) as { iceServers: RTCIceServer | RTCIceServer[] };
    return { iceServers: (Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers]) as RTCIceServer[] };
  } catch (e) {
    console.error("turn creds", e);
    return { iceServers: [] as RTCIceServer[] };
  }
});
