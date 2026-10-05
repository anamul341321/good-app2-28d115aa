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
