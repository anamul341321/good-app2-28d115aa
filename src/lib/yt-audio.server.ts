const PIPED_HOSTS = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.tokhmi.xyz",
];

const INVIDIOUS_HOSTS = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
];

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function pickPiped(json: any): string | null {
  const streams = (json?.audioStreams ?? []) as any[];
  if (!streams.length) return null;
  const best =
    streams
      .filter((stream) => stream?.url && String(stream?.mimeType ?? "audio").includes("audio"))
      .sort((a, b) => Number(b?.bitrate ?? 0) - Number(a?.bitrate ?? 0))
      .find((stream) => Number(stream?.bitrate ?? 0) <= 160_000) ?? streams[0];
  return best?.url ? String(best.url) : null;
}

function pickInvidious(json: any): string | null {
  const formats = (json?.adaptiveFormats ?? []) as any[];
  const audio = formats
    .filter((format) => String(format?.type ?? "").startsWith("audio/") && format?.url)
    .sort((a, b) => Number(b?.bitrate ?? 0) - Number(a?.bitrate ?? 0));
  const best = audio.find((format) => Number(format?.bitrate ?? 0) <= 160_000) ?? audio[0];
  return best?.url ? String(best.url) : null;
}

export async function resolveYoutubeAudioStream(videoId: string): Promise<string | null> {
  const id = videoId.trim();
  for (const host of PIPED_HOSTS) {
    const json = await fetchJson(`${host}/streams/${encodeURIComponent(id)}`);
    const url = json ? pickPiped(json) : null;
    if (url) return url;
  }
  for (const host of INVIDIOUS_HOSTS) {
    const json = await fetchJson(
      `${host}/api/v1/videos/${encodeURIComponent(id)}?fields=adaptiveFormats`,
    );
    const url = json ? pickInvidious(json) : null;
    if (url) return url;
  }
  return null;
}
