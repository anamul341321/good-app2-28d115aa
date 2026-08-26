import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** ইউজারের স্লটে থাকা ফেস ছবি + এখন কোনটা লগইনে bind আছে */
export const listFaceBindSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listSlotFaces, getBoundPhotoPath } = await import("./face-bind.server");
    const [slots, bound] = await Promise.all([
      listSlotFaces(context.userId),
      getBoundPhotoPath(context.userId),
    ]);
    return {
      slots,
      bound: bound.photoPath ? { photoPath: bound.photoPath, status: bound.status } : null,
    };
  });

/** লাইভ ফেস স্ক্যান → নিজের স্লট ছবির সাথে ম্যাচ হলে অটো bind */
export const bindFaceLoginByScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ photoBase64: z.string().min(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { findMatchingSlot, bindSlot } = await import("./face-bind.server");
    const clean = data.photoBase64.includes(",")
      ? data.photoBase64.split(",")[1]!
      : data.photoBase64;

    const match = await findMatchingSlot(context.userId, clean);
    if (!match) {
      return { matched: false as const, slot: null, whitelisted: false };
    }
    const res = await bindSlot(context.userId, match.slot);
    return { matched: true as const, slot: res.slot, whitelisted: res.whitelisted };
  });

/** ইউজার নিজেই স্লট বেছে দিল (সে জানে কোন স্লটে তার নিজের ফেস) */
export const bindFaceLoginBySlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ slot: z.number().int().min(1).max(50) }).parse(input))
  .handler(async ({ data, context }) => {
    const { bindSlot } = await import("./face-bind.server");
    const res = await bindSlot(context.userId, data.slot);
    return { ok: true as const, slot: res.slot, whitelisted: res.whitelisted };
  });

/** ফেস লগইন bind সরিয়ে দেওয়া */
export const unbindFaceLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("face_signups").delete().eq("user_id", context.userId);
    return { ok: true as const };
  });
