import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("posts")
      .select(`
        *,
        author:profiles(id, display_name, avatar_url, uid_seq),
        reactions:post_reactions(id, user_id, reaction_type),
        comments:post_comments(
          id, 
          user_id, 
          body, 
          created_at, 
          author:profiles(id, display_name, avatar_url)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    return { posts: data ?? [] };
  });

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    body: z.string().optional(),
    mediaUrls: z.array(z.string()).default([]),
    mediaType: z.enum(["image", "video"]).default("image")
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        body: data.body,
        media_urls: data.mediaUrls,
        media_type: data.mediaType
      } as any);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reactToPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    postId: z.string().uuid(),
    reactionType: z.string()
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    // Check if user already reacted with this type
    const { data: existing } = await supabase
      .from("post_reactions")
      .select("id, reaction_type")
      .eq("post_id", data.postId)
      .eq("user_id", userId)
      .single();

    if (existing) {
      if (existing.reaction_type === data.reactionType) {
        // Remove reaction if same type (toggle)
        await supabase.from("post_reactions").delete().eq("id", existing.id);
      } else {
        // Update reaction if different type
        await supabase.from("post_reactions").update({ reaction_type: data.reactionType }).eq("id", existing.id);
      }
    } else {
      // Add new reaction
      const { error } = await supabase
        .from("post_reactions")
        .insert({
          post_id: data.postId,
          user_id: userId,
          reaction_type: data.reactionType
        } as any);
      if (error) throw new Error(error.message);
    }

    // Notify post owner if it's a new reaction or change
    const { data: post } = await supabase.from("posts").select("user_id").eq("id", data.postId).single();
    if (post && post.user_id !== userId) {
      await (supabase as any).from("feed_notifications").insert({
        user_id: post.user_id,
        from_user_id: userId,
        type: "like",
        content: "আপনার পোস্টে রিঅ্যাকশন পড়েছে",
        reference_id: data.postId,
      });
    }

    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    postId: z.string().uuid(),
    parentId: z.string().uuid().optional(),
    body: z.string().min(1)
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("post_comments")
      .insert({
        post_id: data.postId,
        user_id: userId,
        parent_id: data.parentId,
        body: data.body
      } as any);

    if (error) throw new Error(error.message);

    // Notify post owner
    const { data: post } = await supabase.from("posts").select("user_id").eq("id", data.postId).single();
    if (post && post.user_id !== userId) {
      await (supabase as any).from("feed_notifications").insert({
        user_id: post.user_id,
        from_user_id: userId,
        type: "comment",
        content: "আপনার পোস্টে নতুন মন্তব্য",
        reference_id: data.postId,
      });
    }

    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("posts").delete().eq("id", data.postId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listStories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("stories")
      .select(`
        *,
        author:profiles(id, display_name, avatar_url)
      `)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { stories: data ?? [] };
  });

export const createStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    mediaUrl: z.string(),
    mediaType: z.enum(["image", "video"]).default("image")
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("stories")
      .insert({
        user_id: userId,
        media_url: data.mediaUrl,
        media_type: data.mediaType
      } as any);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const searchUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ query: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const q = data.query.trim();
    if (!q) return { users: [] };

    // Phone normalization
    let phoneQ = q;
    if (q.startsWith('+880')) phoneQ = q.substring(4);
    else if (q.startsWith('880')) phoneQ = q.substring(3);
    else if (q.startsWith('0')) phoneQ = q.substring(1);

    const isNumeric = /^\d+$/.test(q);
    let orFilter = `display_name.ilike.%${q}%,phone_number.ilike.%${phoneQ}%`;
    if (isNumeric) {
      orFilter += `,uid_seq.eq.${q}`;
    }

    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, uid_seq, phone_number")
      .or(orFilter)
      .neq("id", userId)
      .limit(20);

    if (error) throw new Error(error.message);
    return { users: users ?? [] };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("feed_notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return { notifications: data ?? [] };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("feed_notifications")
      .update({ is_read: true })
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProfileById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.userId)
      .single();

    if (error) throw new Error(error.message);
    return { profile };
  });
