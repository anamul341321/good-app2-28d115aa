import { sendCancelCallPush, sendIncomingCallPush } from "./push.server";

type AuthContext = {
  userId: string;
  supabase: any;
};

export async function createCallSession(
  context: AuthContext,
  input: { peerId: string; video: boolean; offer: unknown },
) {
  if (!input.peerId || input.peerId === context.userId) throw new Error("ভুল কল");

  const { data: link } = await context.supabase
    .from("friend_links")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${context.userId},addressee_id.eq.${input.peerId}),and(requester_id.eq.${input.peerId},addressee_id.eq.${context.userId})`,
    )
    .maybeSingle();
  if (!link) throw new Error("শুধু বন্ধুকে কল করা যাবে");

  const [{ data: profile }, { data: call, error }] = await Promise.all([
    context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle(),
    context.supabase
      .from("call_sessions")
      .insert({
        caller_id: context.userId,
        callee_id: input.peerId,
        call_type: input.video ? "video" : "audio",
        status: "ringing",
        offer: input.offer,
        ringing_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle(),
  ]);
  if (error || !call) throw new Error("কল শুরু করা যায়নি");

  const callerName = profile?.display_name ?? "একজন বন্ধু";
  await sendIncomingCallPush(input.peerId, {
    callId: call.id,
    callerId: context.userId,
    callerName,
    video: input.video,
  });
  return { callId: call.id as string };
}

export async function getCallSession(context: AuthContext, callId: string) {
  if (!callId) return { call: null };
  const { data: call } = await context.supabase
    .from("call_sessions")
    .select("id, caller_id, callee_id, call_type, status, offer, answer, created_at")
    .eq("id", callId)
    .maybeSingle();
  if (!call) return { call: null };

  const otherId = call.caller_id === context.userId ? call.callee_id : call.caller_id;
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("display_name")
    .eq("id", otherId)
    .maybeSingle();
  return {
    call: {
      id: call.id,
      callerId: call.caller_id,
      calleeId: call.callee_id,
      video: call.call_type === "video",
      status: call.status,
      offer: call.offer,
      answer: call.answer,
      otherId,
      otherName: profile?.display_name ?? "ইউজার",
      createdAt: call.created_at,
    },
  };
}

export async function updateCallSession(
  context: AuthContext,
  input: { callId: string; status: string; answer?: unknown; reason?: string },
) {
  const allowed = ["accepted", "declined", "missed", "ended", "failed", "cancelled"];
  if (!input.callId || !allowed.includes(input.status)) return { ok: false };
  const { data: existing } = await context.supabase
    .from("call_sessions")
    .select("caller_id, callee_id, status")
    .eq("id", input.callId)
    .maybeSingle();
  if (!existing) return { ok: false };
  const patch: Record<string, unknown> = { status: input.status };
  if (input.answer) patch.answer = input.answer;
  if (input.reason) patch.ended_reason = input.reason;
  if (input.status === "accepted") patch.accepted_at = new Date().toISOString();
  if (["declined", "missed", "ended", "failed", "cancelled"].includes(input.status)) {
    patch.ended_at = new Date().toISOString();
  }
  const { error } = await context.supabase
    .from("call_sessions")
    .update(patch)
    .eq("id", input.callId);
  if (!error && ["declined", "ended", "cancelled", "missed", "failed"].includes(input.status)) {
    const otherUserId = existing.caller_id === context.userId
      ? existing.callee_id
      : existing.caller_id;
    await sendCancelCallPush(otherUserId, input.callId);
  }
  return { ok: !error };
}
