import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    query: z.string().optional()
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let query = supabase
      .from("profiles")
      .select("id, display_name, avatar_url, uid_seq", { count: "exact" })
      .neq("id", userId);

    if (data.query) {
      query = query.or(`display_name.ilike.%${data.query}%,uid_seq.ilike.%${data.query}%`);
    }

    const { data: users, error, count } = await query
      .range((data.page - 1) * data.limit, data.page * data.limit - 1)
      .order("display_name");

    if (error) throw new Error(error.message);
    return { users: users ?? [], count: count ?? 0 };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    displayName: z.string().optional(),
    avatarUrl: z.string().optional()
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: data.displayName,
        avatar_url: data.avatarUrl
      })
      .eq("id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const followUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    followingId: z.string().uuid()
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("friendships")
      .insert({
        user_id: userId,
        friend_id: data.followingId,
        status: "pending"
      } as any);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
