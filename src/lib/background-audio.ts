/**
 * Background audio playback support.
 *
 * Mobile browsers pause <video> elements when the tab/screen goes to the
 * background. To keep songs playing (with a media notification and lock-screen
 * controls) we mirror the playing media into a hidden shared <audio> element
 * whenever the page becomes hidden, and hand control back to the video when
 * the user returns.
 */

export type BackgroundMediaInfo = {
  title: string;
  artist?: string;
  artwork?: string;
};

type Handlers = {
  onNext?: () => void;
  onPrev?: () => void;
};

let audioEl: HTMLAudioElement | null = null;
let nativeOwner = 0;

function beginNativeMediaPlayback(info: BackgroundMediaInfo) {
  try {
    const bridge = (window as any).GoodAppDownloader;
    if (bridge?.beginMediaPlaybackInfo) {
      bridge.beginMediaPlaybackInfo(info.title, info.artist || "good-app");
      return;
    }
    bridge?.beginMediaPlayback?.();
  } catch {
    // native bridge optional
  }
}

function beginNativeUrlPlayback(src: string, positionSeconds: number, info: BackgroundMediaInfo): boolean {
  try {
    const bridge = (window as any).GoodAppDownloader;
    if (!bridge?.playMediaUrl) return false;
    bridge.playMediaUrl(src, Math.max(0, Math.floor(positionSeconds * 1000)), info.title, info.artist || "good-app");
    return true;
  } catch {
    return false;
  }
}

function prepareNativeUrlPlayback(src: string, info: BackgroundMediaInfo): boolean {
  try {
    const bridge = (window as any).GoodAppDownloader;
    if (!bridge?.prepareMediaUrl) return false;
    bridge.prepareMediaUrl(src, info.title, info.artist || "good-app");
    return true;
  } catch {
    return false;
  }
}

function endNativeMediaPlayback() {
  try {
    (window as any).GoodAppDownloader?.endMediaPlayback?.();
  } catch {
    // native bridge optional
  }
}

function claimNativePlayback() {
  nativeOwner += 1;
  return nativeOwner;
}

function releaseNativePlayback(owner: number) {
  if (owner !== nativeOwner) return;
  endNativeMediaPlayback();
}

function getAudio(): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  if (audioEl) return audioEl;
  const el = document.createElement("audio");
  el.setAttribute("playsinline", "true");
  el.preload = "auto";
  el.style.display = "none";
  el.id = "goodapp-background-audio";
  document.body.appendChild(el);
  audioEl = el;
  return el;
}

export function setMediaSessionMetadata(info: BackgroundMediaInfo) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    const MM = (window as any).MediaMetadata;
    if (!MM) return;
    (navigator as any).mediaSession.metadata = new MM({
      title: info.title,
      artist: info.artist || "good-app",
      album: "good-app",
      artwork: info.artwork
        ? [{ src: info.artwork, sizes: "512x512", type: "image/jpeg" }]
        : [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    });
  } catch {
    // metadata is best-effort
  }
}

function setMediaSessionHandlers(target: HTMLMediaElement | null, handlers: Handlers) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const ms = (navigator as any).mediaSession;
  const safe = (action: string, fn: (() => void) | null) => {
    try {
      ms.setActionHandler(action, fn);
    } catch {
      // unsupported action
    }
  };
  safe("play", () => {
    void (audioEl && !audioEl.paused ? null : audioEl?.play().catch(() => {}));
    void target?.play?.().catch(() => {});
  });
  safe("pause", () => {
    audioEl?.pause();
    target?.pause?.();
  });
  safe("nexttrack", handlers.onNext ? () => handlers.onNext?.() : null);
  safe("previoustrack", handlers.onPrev ? () => handlers.onPrev?.() : null);
  safe("seekbackward", () => {
    const el = audioEl && !audioEl.paused ? audioEl : target;
    if (el) el.currentTime = Math.max(0, el.currentTime - 10);
  });
  safe("seekforward", () => {
    const el = audioEl && !audioEl.paused ? audioEl : target;
    if (el) el.currentTime = el.currentTime + 10;
  });
}

/**
 * Keeps the given <video> element's audio playing when the app goes to the
 * background. Returns a cleanup function.
 */
export function attachBackgroundAudio(
  video: HTMLMediaElement,
  src: string,
  info: BackgroundMediaInfo,
  handlers: Handlers = {},
): () => void {
  const nativePlaybackOwner = claimNativePlayback();
  const audio = getAudio();
  setMediaSessionMetadata(info);
  setMediaSessionHandlers(video, handlers);

  let usingAudio = false;
  let usingNative = false;
  let backgroundStartedAt = 0;
  let backgroundStartPosition = 0;
  let wasPlaying = !video.paused;

  const rememberPlaying = () => {
    wasPlaying = true;
    // Start the foreground service while the Activity is still visible. Android
    // 12+ can reject a brand-new foreground service after the app is hidden.
    // Prepare the URL here too: once the screen turns off Android may freeze the
    // WebView before its background event can finish a fresh network handoff.
    beginNativeMediaPlayback(info);
    prepareNativeUrlPlayback(src, info);
  };
  const rememberPaused = () => {
    if (!usingAudio && !usingNative) wasPlaying = false;
  };

  const toBackground = () => {
    if (usingAudio || usingNative || !wasPlaying || !src) return;
    backgroundStartPosition = video.currentTime;
    backgroundStartedAt = Date.now();
    // Pause WebView playback before handing the same timestamp to Android, so
    // the two players never overlap during the lifecycle transition.
    video.pause();
    if (beginNativeUrlPlayback(src, video.currentTime, info)) {
      usingNative = true;
      return;
    }
    if (!audio) return;
    usingAudio = true;
    if (audio.src !== src) audio.src = src;
    audio.currentTime = video.currentTime;
    audio.play().catch(() => {});
    setMediaSessionMetadata(info);
  };

  const toForeground = () => {
    if (usingNative) {
      usingNative = false;
      endNativeMediaPlayback();
      const elapsed = Math.max(0, (Date.now() - backgroundStartedAt) / 1000);
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.min(video.duration, backgroundStartPosition + elapsed);
      }
      video.play().catch(() => {});
      return;
    }
    if (!audio || !usingAudio) return;
    usingAudio = false;
    const at = audio.currentTime;
    audio.pause();
    if (at > 0) video.currentTime = at;
    video.play().catch(() => {});
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") toBackground();
    else toForeground();
  };

  const onNativeBackground = () => toBackground();

  const onEnded = () => handlers.onNext?.();

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onNativeBackground);
  window.addEventListener("goodapp-background", onNativeBackground);
  window.addEventListener("goodapp-foreground", toForeground);
  video.addEventListener("play", rememberPlaying);
  video.addEventListener("pause", rememberPaused);
  audio?.addEventListener("ended", onEnded);

  if (!video.paused) rememberPlaying();

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onNativeBackground);
    window.removeEventListener("goodapp-background", onNativeBackground);
    window.removeEventListener("goodapp-foreground", toForeground);
    video.removeEventListener("play", rememberPlaying);
    video.removeEventListener("pause", rememberPaused);
    audio?.removeEventListener("ended", onEnded);
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    usingAudio = false;
    usingNative = false;
    setMediaSessionHandlers(null, {});
    releaseNativePlayback(nativePlaybackOwner);
  };
}

/**
 * For embedded (iframe) players we cannot mirror the audio stream, so we keep
 * asking the embed to resume playback while the app is in the background and
 * publish media metadata so a notification is shown.
 */
export function attachBackgroundEmbed(
  getWindow: () => Window | null | undefined,
  origin: string,
  info: BackgroundMediaInfo,
  handlers: Handlers = {},
  opts: {
    /** Direct audio stream URL for the embedded video (if resolved). */
    getAudioSrc?: () => string | null | undefined;
    /** Current playback position of the embed, in seconds. */
    getPosition?: () => number;
  } = {},
): () => void {
  const nativePlaybackOwner = claimNativePlayback();
  setMediaSessionMetadata(info);
  setMediaSessionHandlers(null, handlers);

  const command = (func: "playVideo" | "pauseVideo", args: unknown[] = []) => {
    try {
      getWindow()?.postMessage(JSON.stringify({ event: "command", func, args }), origin);
    } catch {
      // embed not ready
    }
  };

  const seek = (seconds: number) => {
    try {
      getWindow()?.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
        origin,
      );
    } catch {
      // embed not ready
    }
  };

  let timer: number | null = null;
  let usingNative = false;
  let usingAudio = false;
  let backgroundStartedAt = 0;
  let backgroundStartPosition = 0;
  let lastPreparedSrc: string | null = null;

  const audio = getAudio();

  const prepare = () => {
    const src = opts.getAudioSrc?.();
    if (!src || src === lastPreparedSrc) return;
    lastPreparedSrc = src;
    beginNativeMediaPlayback(info);
    prepareNativeUrlPlayback(src, info);
  };

  const toBackground = () => {
    if (usingNative || usingAudio) return;
    const src = opts.getAudioSrc?.();
    if (!src) {
      // No direct stream: keep nudging the embed (best effort, web only).
      command("playVideo");
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(() => command("playVideo"), 1500);
      return;
    }
    backgroundStartPosition = Math.max(0, opts.getPosition?.() ?? 0);
    backgroundStartedAt = Date.now();
    command("pauseVideo");
    if (beginNativeUrlPlayback(src, backgroundStartPosition, info)) {
      usingNative = true;
      return;
    }
    if (!audio) return;
    usingAudio = true;
    if (audio.src !== src) audio.src = src;
    try {
      audio.currentTime = backgroundStartPosition;
    } catch {
      // seek before metadata is fine
    }
    audio.play().catch(() => {});
    setMediaSessionMetadata(info);
  };

  const toForeground = () => {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
    if (usingNative) {
      usingNative = false;
      endNativeMediaPlayback();
      const elapsed = Math.max(0, (Date.now() - backgroundStartedAt) / 1000);
      seek(backgroundStartPosition + elapsed);
      command("playVideo");
      return;
    }
    if (usingAudio && audio) {
      usingAudio = false;
      const at = audio.currentTime;
      audio.pause();
      if (at > 0) seek(at);
      command("playVideo");
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") toBackground();
    else toForeground();
  };

  const onHide = () => toBackground();
  const onEnded = () => handlers.onNext?.();

  // Keep the native player primed while the app is still in the foreground.
  prepare();
  const prepareTimer = window.setInterval(prepare, 2000);

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onHide);
  window.addEventListener("goodapp-background", onHide);
  window.addEventListener("goodapp-foreground", toForeground);
  audio?.addEventListener("ended", onEnded);
  beginNativeMediaPlayback(info);

  return () => {
    if (timer) window.clearInterval(timer);
    window.clearInterval(prepareTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onHide);
    window.removeEventListener("goodapp-background", onHide);
    window.removeEventListener("goodapp-foreground", toForeground);
    audio?.removeEventListener("ended", onEnded);
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    usingNative = false;
    usingAudio = false;
    setMediaSessionHandlers(null, {});
    releaseNativePlayback(nativePlaybackOwner);
  };
}

