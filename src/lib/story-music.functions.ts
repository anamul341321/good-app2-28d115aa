import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * আসল গান সার্চ — iTunes Search API থেকে গানের নাম অনুযায়ী সত্যিকারের
 * প্রিভিউ (৩০ সেকেন্ড) আনা হয়, তাই নাম এক আর গান আরেকটা—এমন হবে না।
 */
export const searchStoryMusic = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ query: z.string().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data }) => {
    const term = encodeURIComponent(data.query.trim());
    const url = `https://itunes.apple.com/search?media=music&entity=song&limit=25&term=${term}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return { tracks: [] };
      const json = (await res.json()) as any;
      const tracks = ((json?.results ?? []) as any[])
        .filter((r) => r?.previewUrl)
        .map((r) => ({
          id: `it:${r.trackId}`,
          title: String(r.trackName ?? "Unknown"),
          artist: String(r.artistName ?? "Unknown"),
          genre: String(r.primaryGenreName ?? "Music"),
          audioUrl: String(r.previewUrl),
          artwork: r.artworkUrl100 ? String(r.artworkUrl100) : null,
        }));
      return { tracks };
    } catch {
      return { tracks: [] };
    }
  });
