import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** ইউজারের নিজের অপঠিত নোটিশ (admin থেকে পাঠানো ব্যক্তিগত মেসেজ) */
export const getMyNotices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_notices")
      .select("id, title, body, created_at")
      .eq("user_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    return (data ?? []) as Array<{ id: string; title: string | null; body: string; created_at: string }>;
  });

/** নোটিফিকেশন সেন্টার — পড়া/অপঠিত সব নোটিফিকেশন */
export const getMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_notices")
      .select("id, title, body, created_at, read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);
    const rows = (data ?? []) as Array<{
      id: string; title: string | null; body: string; created_at: string; read_at: string | null;
    }>;
    return {
      unread: rows.filter((r) => !r.read_at).length,
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        createdAt: r.created_at,
        read: !!r.read_at,
      })),
    };
  });

/** সব নোটিফিকেশন পড়া হিসেবে মার্ক করো */
export const markAllNoticesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("user_notices")
      .update({ read_at: new Date().toISOString() } as any)
      .eq("user_id", userId)
      .is("read_at", null);
    return { ok: true };
  });

/** নোটিশ পড়া হয়েছে — বন্ধ করে দাও */
export const markNoticeRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_notices")
      .update({ read_at: new Date().toISOString() } as any)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
