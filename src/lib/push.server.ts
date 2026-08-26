// Server-only Firebase Cloud Messaging (HTTP v1) sender.
// Needs the FIREBASE_SERVICE_ACCOUNT_JSON secret (the service-account JSON
// downloaded from the Firebase console). Without it push is silently skipped
// so the rest of the app keeps working exactly as before.

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

let cachedToken: { token: string; exp: number } | null = null;

function b64url(input: ArrayBuffer | string) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf;
}

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.client_email || !sa.private_key || !sa.project_id) return null;
    return { ...sa, private_key: sa.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const assertion = `${header}.${claims}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`FCM auth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

/** এক বা একাধিক device token-এ push পাঠায়। token invalid হলে DB থেকে মুছে দেয়। */
export async function sendPushToTokens(
  tokens: string[],
  payload: { title: string; body: string; url?: string; data?: Record<string, string>; call?: boolean; collapseKey?: string },
): Promise<{ sent: number; failed: number }> {
  const sa = readServiceAccount();
  if (!sa || tokens.length === 0) return { sent: 0, failed: 0 };

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e) {
    console.error("[push] auth error", e);
    return { sent: 0, failed: tokens.length };
  }

  const dead: string[] = [];
  let sent = 0;
  const isNativeHandled = payload.call || payload.data?.type === "chat_message" || payload.data?.type === "social_notification";
  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${accessToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: isNativeHandled ? undefined : { title: payload.title, body: payload.body },
                data: {
                  ...(payload.data ?? {}),
                  ...(isNativeHandled ? { title: payload.title, body: payload.body } : {}),
                  ...(payload.url ? { url: payload.url } : {}),
                },
                android: {
                  priority: "HIGH",
                  // Chat/social pushes must survive a sleeping or offline phone,
                  // otherwise FCM drops them and nothing ever arrives.
                  ttl: payload.call ? "60s" : "86400s",
                  collapseKey: payload.collapseKey,
                  notification: isNativeHandled
                    ? undefined
                    : { sound: "default", default_vibrate_timings: true },
                },
              },
            }),
          },
        );
        if (res.ok) {
          sent++;
          return;
        }
        const text = await res.text();
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(text)) dead.push(token);
        else console.error("[push] send failed", res.status, text);
      } catch (e) {
        console.error("[push] send error", e);
      }
    }),
  );

  if (dead.length) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("push_tokens").delete().in("token", dead);
    } catch {
      /* best effort */
    }
  }

  return { sent, failed: tokens.length - sent };
}

/** Android native incoming-call screen ও ringtone চালানোর জন্য data-only high-priority push। */
export async function sendIncomingCallPush(
  userId: string,
  call: { callId: string; callerId: string; callerName: string; video: boolean },
) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return { sent: 0, failed: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("push_tokens").select("token").eq("user_id", userId);
  const tokens = [...new Set((data ?? []).map((row: any) => row.token as string))];
  return sendPushToTokens(tokens, {
    title: call.video ? "ভিডিও কল আসছে" : "কল আসছে",
    body: call.callerName,
    call: true,
    collapseKey: call.callId,
    data: {
      type: "incoming_call",
      call_id: call.callId,
      caller_id: call.callerId,
      caller_name: call.callerName,
      video: String(call.video),
      url: `/chat/${call.callerId}?call=${call.callId}`,
    },
  });
}

export async function sendCancelCallPush(userId: string, callId: string) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return { sent: 0, failed: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("push_tokens").select("token").eq("user_id", userId);
  const tokens = [...new Set((data ?? []).map((row: any) => row.token as string))];
  return sendPushToTokens(tokens, {
    title: "কল শেষ",
    body: "কলটি আর সক্রিয় নেই",
    call: true,
    collapseKey: `cancel-${callId}`,
    data: { type: "cancel_call", call_id: callId },
  });
}

/** নির্দিষ্ট ইউজারের সব ফোনে push পাঠাও */
export async function sendPushToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    url?: string;
    data?: Record<string, string>;
    collapseKey?: string;
  },
) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return { sent: 0, failed: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);
  const tokens = (data ?? []).map((r: any) => r.token as string);
  return sendPushToTokens(tokens, payload);
}

/** অ্যাডমিন ডিভাইসগুলোতে push (admin_push_targets টেবিলে যাদের রাখা আছে) */
export async function sendPushToAdmins(payload: { title: string; body: string; url?: string }) {
  const tgFallback = async (reason: string) => {
    try {
      const { alertOwnerPrivate } = await import("./withdraw-fastpay.server");
      await alertOwnerPrivate(`🔔 ${payload.title}\n${payload.body}\n(push যায়নি: ${reason})`);
    } catch {
      /* ignore */
    }
  };

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    await tgFallback("FIREBASE_SERVICE_ACCOUNT_JSON নেই");
    return { sent: 0, failed: 0 };
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targets } = await supabaseAdmin.from("admin_push_targets").select("user_id");
    const ids = (targets ?? []).map((r: any) => r.user_id as string);
    if (ids.length === 0) {
      await tgFallback("কোনো অ্যাডমিন ডিভাইস সেট করা নেই");
      return { sent: 0, failed: 0 };
    }
    const { data } = await supabaseAdmin.from("push_tokens").select("token").in("user_id", ids);
    const tokens = [...new Set((data ?? []).map((r: any) => r.token as string))];
    if (tokens.length === 0) {
      await tgFallback("অ্যাডমিন ফোনে token রেজিস্টার হয়নি");
      return { sent: 0, failed: 0 };
    }
    const res = await sendPushToTokens(tokens, payload);
    console.log("[push] admin push", { devices: tokens.length, ...res });
    if (res.sent === 0) await tgFallback(`সব ডিভাইসে ফেল (${res.failed})`);
    return res;
  } catch (e) {
    console.error("[push] admin push failed", e);
    await tgFallback("সার্ভার এরর");
    return { sent: 0, failed: 0 };
  }
}

/** সব ইউজারের ফোনে push (ব্রডকাস্ট) */
export async function sendPushToAllTokens(payload: { title: string; body: string; url?: string }) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return { sent: 0, failed: 0, devices: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const all: string[] = [];
  const page = 1000;
  for (let from = 0; from < 50_000; from += page) {
    const { data } = await supabaseAdmin
      .from("push_tokens")
      .select("token")
      .range(from, from + page - 1);
    const rows = data ?? [];
    all.push(...rows.map((r: any) => r.token as string));
    if (rows.length < page) break;
  }
  const tokens = [...new Set(all)];
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < tokens.length; i += 200) {
    const res = await sendPushToTokens(tokens.slice(i, i + 200), payload);
    sent += res.sent;
    failed += res.failed;
  }
  return { sent, failed, devices: tokens.length };
}
