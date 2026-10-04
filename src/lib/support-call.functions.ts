import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** লগইন থাকুক বা না থাকুক — কাস্টমার কেয়ারে কল শুরু। */
export const startSupportCall = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ name: z.string().max(60).optional(), phone: z.string().max(20).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    let userId: string | null = null;
    let uid: number | null = null;
    let name = data.name?.trim() || null;
    const auth = getRequestHeader("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token) {
      const { data: u } = await sb.auth.getUser(token);
      if (u?.user) {
        userId = u.user.id;
        const { data: p } = await sb.from("profiles").select("uid_seq, display_name").eq("id", userId).maybeSingle();
        uid = (p as any)?.uid_seq ?? null;
        name = name || (p as any)?.display_name || null;
      }
    }
    const { data: row, error } = await sb
      .from("support_calls")
      .insert({ caller_user_id: userId, caller_uid: uid, caller_name: name, caller_phone: data.phone?.trim() || null })
      .select("id")
      .single();
    if (error) throw new Error("কল শুরু করা যায়নি");
    // অ্যাপ বন্ধ থাকলেও সব অ্যাডমিনের ফোনে নোটিফিকেশন + টেলিগ্রাম
    try {
      const who = `${name ?? "অতিথি"}${uid ? ` · UID ${uid}` : " · লগইন নেই"}`;
      const { sendPushToAdmins } = await import("@/lib/push.server");
      const { alertOwnerPrivate } = await import("@/lib/withdraw-fastpay.server");
      await Promise.allSettled([
        sendPushToAdmins({ title: "📞 কাস্টমার কেয়ারে কল আসছে", body: `${who} — এখনই ধরুন`, url: "/home" }),
        alertOwnerPrivate(`📞 <b>কাস্টমার কেয়ারে কল আসছে</b>\n👤 ${who}\n👉 অ্যাডমিন প্যানেল → ইনকামিং কল থেকে ধরুন`),
      ]);
    } catch { /* নোটিফিকেশন না গেলেও কল চলবে */ }
    return { id: row.id as string, uid, name };
  });

/** কলার কল শেষ করলে / কেউ না ধরলে। */
export const endSupportCall = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), missed: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: row } = await sb.from("support_calls").select("*").eq("id", data.id).maybeSingle();
    if (!row || (row.status !== "ringing" && row.status !== "accepted")) return { ok: true };
    const status = row.status === "accepted" ? "ended" : "missed";
    await sb.from("support_calls").update({ status, ended_at: new Date().toISOString() }).eq("id", data.id);
    if (status === "missed") {
      try {
        const { alertOwnerPrivate } = await import("@/lib/withdraw-fastpay.server");
        await alertOwnerPrivate(
          `📞 <b>মিসড কল — কাস্টমার কেয়ার</b>\n👤 ${row.caller_name ?? "অতিথি"}` +
            (row.caller_uid ? ` • 🆔 UID <code>${row.caller_uid}</code>` : " • লগইন নেই") +
            (row.caller_phone ? `\n📱 ${row.caller_phone}` : ""),
        );
      } catch { /* অ্যালার্ট না গেলেও সমস্যা নেই */ }
    }
    return { ok: true };
  });

async function gate() {
  const { requireAdminSession } = await import("@/lib/admin-session.server");
  await requireAdminSession();
  return admin();
}

export const adminAcceptSupportCall = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await gate();
    const { data: row } = await sb
      .from("support_calls")
      .update({ status: "accepted", answered_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "ringing")
      .select("id")
      .maybeSingle();
    return { ok: !!row };
  });

export const adminEndSupportCall = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await gate();
    await sb.from("support_calls").update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", data.id).in("status", ["ringing", "accepted"]);
    return { ok: true };
  });

export const adminListSupportCalls = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await gate();
  const { data } = await sb.from("support_calls").select("*").order("created_at", { ascending: false }).limit(200);
  return data ?? [];
});

// ── অ্যাপের ভেতরের কল এজেন্ট (অ্যাডমিন প্যানেল থেকে যাদের এজেন্ট বানানো হয়) ──

async function agentGate(userId: string) {
  const sb = await admin();
  const { data } = await sb.from("admin_push_targets").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("আপনি কল এজেন্ট নন");
  return sb;
}

export const amICallAgent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try { await agentGate(context.userId); return { agent: true }; } catch { return { agent: false }; }
  });

export const agentAcceptSupportCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await agentGate(context.userId);
    const { data: row } = await sb.from("support_calls")
      .update({ status: "accepted", answered_at: new Date().toISOString() })
      .eq("id", data.id).eq("status", "ringing").select("id").maybeSingle();
    return { ok: !!row };
  });

export const agentEndSupportCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await agentGate(context.userId);
    await sb.from("support_calls").update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", data.id).in("status", ["ringing", "accepted"]);
    return { ok: true };
  });
