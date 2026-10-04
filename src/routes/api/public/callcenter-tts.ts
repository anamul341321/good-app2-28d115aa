import { createFileRoute } from "@tanstack/react-router";
import { CALL_CENTER_SCRIPTS } from "@/lib/callcenter-scripts";

const CALL_CENTER_AUDIO_CACHE_MAX = 100;

const audioCache = new Map<string, { bytes: Uint8Array; at: number }>();

function cacheGet(key: string): Uint8Array | null {
  const hit = audioCache.get(key);
  return hit ? hit.bytes : null;
}

function cachePut(key: string, bytes: Uint8Array) {
  if (audioCache.size >= CALL_CENTER_AUDIO_CACHE_MAX) {
    const oldest = [...audioCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) audioCache.delete(oldest[0]);
  }
  audioCache.set(key, { bytes, at: Date.now() });
}

export const Route = createFileRoute("/api/public/callcenter-tts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key") || "greeting";
        const script = CALL_CENTER_SCRIPTS.find((s) => s.key === key);
        if (!script) {
          return new Response("unknown key", { status: 404 });
        }

        const cached = cacheGet(script.key);
        if (cached) {
          return new Response(new Blob([cached], { type: "audio/wav" }), {
            headers: {
              "Content-Type": "audio/wav",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }

        try {
          const { speakBengali } = await import("@/lib/tts-free.server");
          const wav = await speakBengali(script.text);
          if (!wav) {
            return new Response("voice unavailable", { status: 503 });
          }
          cachePut(script.key, wav);
          return new Response(new Blob([wav], { type: "audio/wav" }), {
            headers: {
              "Content-Type": "audio/wav",
              "Cache-Control": "public, max-age=86400",
            },
          });
        } catch (e) {
          console.error("callcenter tts failed", e);
          return new Response("voice unavailable", { status: 503 });
        }
      },
    },
  },
});
