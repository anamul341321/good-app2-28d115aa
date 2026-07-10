import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// User-facing: list active announcements
export const listActiveAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data } = await sb
      .from("announcements")
      .select("id, message, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []) as { id: string; message: string; created_at: string }[];
  });

// Admin-side
async function gate() {
  const { requireAdminSession } = await import("@/lib/admin-session.server");
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const adminListAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  const db = await gate();
  const { data } = await db.from("announcements").select("*").order("created_at", { ascending: false });
  return (data ?? []) as { id: string; message: string; is_active: boolean; created_at: string }[];
});

export const adminCreateAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ message: z.string().min(2).max(5000) }).parse(i))
  .handler(async ({ data }) => {
    const db = await gate();
    const { error } = await db.from("announcements").insert({ message: data.message.trim(), is_active: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminToggleAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data }) => {
    const db = await gate();
    const { error } = await db.from("announcements").update({ is_active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const db = await gate();
    const { error } = await db.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
