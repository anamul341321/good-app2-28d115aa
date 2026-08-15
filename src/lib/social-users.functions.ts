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
    
    // Base query: profiles except the current user
    let queryBuilder = supabase
      .from("profiles")
      .select("id, display_name, avatar_url, uid_seq, phone_number", { count: "exact" })
      .neq("id", userId);

    if (data.query) {
      const q = data.query.trim();
      
      // Handle phone normalization for query (017... -> 17...)
      let phoneQ = q;
      if (q.startsWith('+880')) phoneQ = q.substring(4);
      else if (q.startsWith('880')) phoneQ = q.substring(3);
      else if (q.startsWith('0')) phoneQ = q.substring(1);

      const isNumeric = /^\d+$/.test(q);
      
      // Case-insensitive search on display_name and ilike on phone_number
      // If numeric, also check uid_seq
      let orFilter = `display_name.ilike.%${q}%,phone_number.ilike.%${phoneQ}%`;
      if (isNumeric) {
        orFilter += `,uid_seq.eq.${q}`;
      }

      queryBuilder = queryBuilder.or(orFilter);
    } else {
      // Suggestion mode: Prioritize users with mutual friends
      // We'll fetch them normally and sort later
    }

    const { data: users, error, count } = await queryBuilder
      .order("created_at", { ascending: false })
      .range((data.page - 1) * data.limit, data.page * data.limit - 1);

    if (error) throw new Error(error.message);

    if (!users || users.length === 0) return { users: [], count: count ?? 0 };

    // Fetch current user's friends to calculate mutual friends
    const { data: myFriends } = await supabase
      .from("friendships" as any)
      .select("user_id, friend_id")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    
    const myFriendIds = new Set(
      ((myFriends as any[]) || []).map(f => f.user_id === userId ? f.friend_id : f.user_id)
    );

    // Fetch friendships for all listed users relative to current user
    const userIds = users.map(u => u.id);
    const { data: friendships } = await supabase
      .from("friendships" as any)
      .select("*")
      .or(`and(user_id.eq.${userId},friend_id.in.("${userIds.join('","')}")),and(friend_id.eq.${userId},user_id.in.("${userIds.join('","')}")`);

    // Fetch mutual friends info (this is expensive, so we do it per page batch)
    const { data: allAcceptedFriends } = await supabase
      .from("friendships" as any)
      .select("user_id, friend_id")
      .eq("status", "accepted")
      .or(`user_id.in.("${userIds.join('","')}"),friend_id.in.("${userIds.join('","')}")`);

    const usersWithFriendship = users.map(u => {
      const friendship = (friendships as any[])?.find(f => 
        (f.user_id === userId && f.friend_id === u.id) || 
        (f.friend_id === userId && f.user_id === u.id)
      );

      // Simple status mapping
      let status: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none';
      if (friendship) {
        if (friendship.status === 'accepted') {
          status = 'accepted';
        } else if (friendship.status === 'pending') {
          status = friendship.user_id === userId ? 'pending_sent' : 'pending_received';
        }
      }

      // Calculate mutual friends
      const theirFriends = new Set(
        (allAcceptedFriends as any[])
          ?.filter(f => f.user_id === u.id || f.friend_id === u.id)
          .map(f => f.user_id === u.id ? f.friend_id : f.user_id)
      );

      const mutualCount = Array.from(myFriendIds).filter(id => theirFriends.has(id)).length;

      return { ...u, friendship, status, mutualCount };
    });

    // If it's a suggestion list (no query), sort by mutual friends count
    if (!data.query) {
      usersWithFriendship.sort((a, b) => (b.mutualCount || 0) - (a.mutualCount || 0));
    }

    return { users: usersWithFriendship, count: count ?? 0 };
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

    const senderId = (request as any).user_id === userId ? (request as any).friend_id : (request as any).user_id;
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
      supabase.from("mining_state").select("is_active, accrued_amount").eq("user_id", data.userId).maybeSingle()
    ]);

    const verifiedCount = (tasksRes.data ?? []).filter(t => !!t.initial_verify_at).length;
    const monthlyRate = (miningRes.data as any)?.monthly_rate 
      ?? ((miningRes.data?.is_active && verifiedCount >= 10) ? 500 : 0);

    return { verifiedCount, monthlyRate };
  });
