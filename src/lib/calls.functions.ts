import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createCallSession, getCallSession, notifyIncomingCall, persistCallOffer, updateCallSession } from "./calls.server";

export const createCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { peerId: string; video: boolean; offer: unknown }) => ({
    peerId: String(input?.peerId ?? ""),
    video: !!input?.video,
    offer: input?.offer ?? null,
  }))
  .handler(({ data, context }) => createCallSession(context, data));

export const resolveCallUid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { uid: number }) => ({ uid: Math.floor(Number(input?.uid ?? 0)) }))
  .handler(async ({ data, context }) => {
    if (!Number.isFinite(data.uid) || data.uid < 1) throw new Error("সঠিক UID লিখুন");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, uid_seq")
      .eq("uid_seq", data.uid)
      .maybeSingle();
    if (!profile) throw new Error("এই UID-তে কোনো ইউজার নেই");
    if (profile.id === context.userId) throw new Error("নিজেকে কল করা যাবে না");
    return { userId: profile.id, name: profile.display_name ?? `UID ${data.uid}`, uid: profile.uid_seq };
  });

export const getCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callId: string }) => ({ callId: String(input?.callId ?? "") }))
  .handler(({ data, context }) => getCallSession(context, data.callId));

export const ringCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callId: string }) => ({ callId: String(input?.callId ?? "") }))
  .handler(({ data, context }) => notifyIncomingCall(context, data));

export const saveCallOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callId: string; offer: unknown }) => ({
    callId: String(input?.callId ?? ""),
    offer: input?.offer ?? null,
  }))
  .handler(({ data, context }) => persistCallOffer(context, data));

export const updateCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callId: string; status: string; answer?: unknown; reason?: string }) => ({
    callId: String(input?.callId ?? ""),
    status: String(input?.status ?? ""),
    answer: input?.answer,
    reason: input?.reason ? String(input.reason).slice(0, 80) : undefined,
  }))
  .handler(({ data, context }) => updateCallSession(context, data));

export const listRecentCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase
      .from("call_sessions")
      .select("id, caller_id, callee_id, call_type, status, accepted_at, ended_at, created_at")
      .or(`caller_id.eq.${context.userId},callee_id.eq.${context.userId}`)
      .order("created_at", { ascending: false })
      .limit(40);
    const list = (rows ?? []) as any[];
    const ids = [...new Set(list.map((r) => (r.caller_id === context.userId ? r.callee_id : r.caller_id)))];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, display_name, uid_seq").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return list.map((r) => {
      const outgoing = r.caller_id === context.userId;
      const otherId = outgoing ? r.callee_id : r.caller_id;
      const p: any = map.get(otherId);
      const secs = r.accepted_at && r.ended_at
        ? Math.max(0, Math.round((new Date(r.ended_at).getTime() - new Date(r.accepted_at).getTime()) / 1000))
        : 0;
      return {
        id: r.id as string,
        otherId: otherId as string,
        name: (p?.display_name ?? "ইউজার") as string,
        uid: (p?.uid_seq ?? null) as number | null,
        outgoing,
        video: r.call_type === "video",
        answered: !!r.accepted_at,
        seconds: secs,
        at: r.created_at as string,
      };
    });
  });
