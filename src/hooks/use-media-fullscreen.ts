import { useCallback, useEffect, useState, type RefObject } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

export function useMediaFullscreen(ref: RefObject<HTMLElement | null>) {
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const doc = document as FullscreenDocument;
      setNativeFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync as EventListener);
    };
  }, []);

  const exit = useCallback(async () => {
    const doc = document as FullscreenDocument;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await doc.webkitExitFullscreen?.();
    } catch {
      // CSS fullscreen remains the reliable WebView fallback.
    }
    setFallbackFullscreen(false);
    try { (window as any).GoodAppDownloader?.exitVideoFullscreen?.(); } catch { /* browser */ }
    try { (screen.orientation as any)?.unlock?.(); } catch { /* unsupported */ }
  }, []);

  const toggle = useCallback(async () => {
    const doc = document as FullscreenDocument;
    if (fallbackFullscreen || document.fullscreenElement || doc.webkitFullscreenElement) {
      await exit();
      return;
    }

    const element = ref.current as FullscreenElement | null;
    const video = element?.querySelector("video") as FullscreenVideo | null;
    let requested = false;
    try {
      if (element?.requestFullscreen) {
        await element.requestFullscreen();
        requested = true;
      } else if (element?.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
        requested = true;
      } else if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        requested = true;
      }
    } catch {
      requested = false;
    }
    if (!requested) setFallbackFullscreen(true);
    try { (window as any).GoodAppDownloader?.enterVideoFullscreen?.(); } catch { /* browser */ }
    try { await (screen.orientation as any)?.lock?.("landscape"); } catch { /* unsupported */ }
  }, [exit, fallbackFullscreen, ref]);

  useEffect(() => () => {
    try { (window as any).GoodAppDownloader?.exitVideoFullscreen?.(); } catch { /* browser */ }
  }, []);

  return {
    isFullscreen: fallbackFullscreen || nativeFullscreen,
    fallbackFullscreen,
    toggleFullscreen: toggle,
    exitFullscreen: exit,
  };
}
