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
    let queryBuilder = supabase
      .from("profiles")
      .select("id, display_name, avatar_url, uid_seq", { count: "exact" })
      .neq("id", userId);

    if (data.query) {
      queryBuilder = queryBuilder.or(`display_name.ilike.%${data.query}%,uid_seq.ilike.%${data.query}%`);
    }

    const { data: users, error, count } = await queryBuilder
      .range((data.page - 1) * data.limit, data.page * data.limit - 1)
      .order("display_name");

    if (error) throw new Error(error.message);
    
    // Check friendship status for each user
    const userIds = users?.map(u => u.id) || [];
    const { data: friendships } = await supabase
      .from("friendships" as any)
      .select("*")
      .or(`user_id.in.(${userIds.join(',')}),friend_id.in.(${userIds.join(',')})`)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    const usersWithFriendship = users?.map(u => {
      const friendship = friendships?.find(f => 
        (f.user_id === userId && f.friend_id === u.id) || 
        (f.friend_id === userId && f.user_id === u.id)
      );
      return { ...u, friendship };
    });

    return { users: usersWithFriendship ?? [], count: count ?? 0 };
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

export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    friendId: z.string().uuid()
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    // Check if already exists
    const { data: existing } = await supabase
      .from("friendships" as any)
      .select("*")
      .or(`and(user_id.eq.${userId},friend_id.eq.${data.friendId}),and(user_id.eq.${data.friendId},friend_id.eq.${userId})`)
      .maybeSingle();

    if (existing) return { ok: true, existing: true };

    const { error } = await supabase
      .from("friendships" as any)
      .insert({
        user_id: userId,
        friend_id: data.friendId,
        status: "pending"
      });

    if (error) throw new Error(error.message);

    // Notify friend
    await supabase.from("user_notices").insert({
      user_id: data.friendId,
      title: "Friend Request",
      body: "Someone sent you a friend request",
      metadata: { type: "friend_request", sender_id: userId }
    } as any);

    return { ok: true };
  });

export const acceptFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    requestId: z.string().uuid()
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    const { data: request, error: fetchError } = await supabase
      .from("friendships" as any)
      .select("*")
      .eq("id", data.requestId)
      .single();
    
    if (fetchError || !request) throw new Error("Request not found");

    const { error } = await supabase
      .from("friendships" as any)
      .update({ status: "accepted" })
      .eq("id", data.requestId);

    if (error) throw new Error(error.message);

    // Notify sender
    const senderId = request.user_id === userId ? request.friend_id : request.user_id;
    await supabase.from("user_notices").insert({
      user_id: senderId,
      title: "Friend Request Accepted",
      body: "Your friend request was accepted",
      metadata: { type: "friend_request_accepted", friend_id: userId }
    } as any);

    return { ok: true };
  });

export const getProfileStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid()
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [tasksRes, miningRes] = await Promise.all([
      supabaseAdmin.from("tasks").select("id, initial_verify_at").eq("user_id", data.userId),
      supabase.from("mining_state").select("monthly_rate").eq("user_id", data.userId).maybeSingle()
    ]);

    const verifiedCount = (tasksRes.data ?? []).filter(t => !!t.initial_verify_at).length;
    const monthlyRate = miningRes.data?.monthly_rate ?? 0;

    return { verifiedCount, monthlyRate };
  });



