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
    const [{ data: notices }, { data: social }] = await Promise.all([
      supabase
      .from("user_notices")
      .select("id, title, body, created_at, read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
        .limit(40),
      (supabase as any)
        .from("feed_notifications")
        .select("id, type, content, created_at, is_read")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);
    const noticeRows = (notices ?? []) as Array<{
      id: string; title: string | null; body: string; created_at: string; read_at: string | null;
    }>;
    const socialRows = (social ?? []) as Array<{
      id: string; type: string; content: string | null; created_at: string; is_read: boolean;
    }>;
    const items = [
      ...noticeRows.map((r) => ({
        id: `notice-${r.id}`,
        rawId: r.id,
        source: "notice" as const,
        type: "notice",
        title: r.title,
        body: r.body,
        createdAt: r.created_at,
        read: !!r.read_at,
      })),
      ...socialRows.map((r) => ({
        id: `social-${r.id}`,
        rawId: r.id,
        source: "social" as const,
        type: r.type,
        title: socialTitle(r.type),
        body: r.content ?? socialTitle(r.type),
        createdAt: r.created_at,
        read: !!r.is_read,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 60);
    return {
      unread: items.filter((r) => !r.read).length,
      items,
    };
  });

function socialTitle(type: string) {
  if (type === "friend_request") return "ফ্রেন্ড রিকুয়েস্ট";
  if (type === "friend_accept") return "নতুন বন্ধু";
  if (type === "mention") return "মেন্টশন";
  if (type === "comment") return "মন্তব্য";
  if (type === "reply") return "রিপ্লাই";
  if (type === "like") return "রিঅ্যাকশন";
  return "নোটিফিকেশন";
}

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
    await (supabase as any)
      .from("feed_notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
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
