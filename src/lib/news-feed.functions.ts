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
        author:profiles(id, display_name, avatar_url),
        reactions:post_reactions(id, user_id, reaction_type),
        comment_count:post_comments(id)
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
    media_urls: z.array(z.string()).default([]),
    media_type: z.enum(["image", "video"]).default("image")
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        body: data.body,
        media_urls: data.media_urls,
        media_type: data.media_type
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
    const { error } = await supabase
      .from("post_reactions")
      .upsert({
        post_id: data.postId,
        user_id: userId,
        reaction_type: data.reactionType
      } as any, { onConflict: "post_id,user_id" });

    if (error) throw new Error(error.message);
    
    // Notify post owner
    const { data: post } = await supabase.from("posts").select("user_id").eq("id", data.postId).single();
    if (post && post.user_id !== userId) {
      await supabase.from("user_notices").insert({
        user_id: post.user_id,
        title: "New Reaction",
        body: `Someone reacted to your post`,
        metadata: { type: "post_reaction", post_id: data.postId }
      } as any);
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

    return { ok: true };
  });
