import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveYoutubeAudioStream } from "./yt-audio.server";

export const getYoutubeAudioStream = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ videoId: z.string().min(5).max(24) }).parse(i))
  .handler(async ({ data }) => {
    return { url: await resolveYoutubeAudioStream(data.videoId) };
  });
