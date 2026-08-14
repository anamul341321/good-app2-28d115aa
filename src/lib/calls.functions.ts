import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createCallSession, getCallSession, notifyIncomingCall, updateCallSession } from "./calls.server";

export const createCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { peerId: string; video: boolean; offer: unknown }) => ({
    peerId: String(input?.peerId ?? ""),
    video: !!input?.video,
    offer: input?.offer ?? null,
  }))
  .handler(({ data, context }) => createCallSession(context, data));

export const getCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callId: string }) => ({ callId: String(input?.callId ?? "") }))
  .handler(({ data, context }) => getCallSession(context, data.callId));

export const ringCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callId: string }) => ({ callId: String(input?.callId ?? "") }))
  .handler(({ data, context }) => notifyIncomingCall(context, data));

export const updateCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callId: string; status: string; answer?: unknown; reason?: string }) => ({
    callId: String(input?.callId ?? ""),
    status: String(input?.status ?? ""),
    answer: input?.answer,
    reason: input?.reason ? String(input.reason).slice(0, 80) : undefined,
  }))
  .handler(({ data, context }) => updateCallSession(context, data));
