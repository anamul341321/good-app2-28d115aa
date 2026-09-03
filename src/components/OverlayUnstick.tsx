import { useEffect } from "react";

/**
 * Android WebView safety net.
 *
 * Radix dropdowns / dialogs lock the page by setting `pointer-events: none`
 * and `overflow: hidden` on <body>. In the WebView a touch-cancelled close
 * sometimes leaves those styles behind, which makes the page unscrollable and
 * every button (like the header 3-dot menu) look dead. This watcher clears the
 * lock whenever no Radix layer is actually open.
 */
export function OverlayUnstick() {
  useEffect(() => {
    const hasOpenLayer = () =>
      document.querySelector(
        '[data-state="open"][data-radix-popper-content-wrapper], [role="dialog"][data-state="open"], [data-radix-menu-content][data-state="open"], [data-state="open"][data-slot="sheet-content"]',
      ) !== null;

    const unstick = () => {
      if (hasOpenLayer()) return;
      const body = document.body;
      if (body.style.pointerEvents === "none") body.style.removeProperty("pointer-events");
      if (body.style.overflow === "hidden") body.style.removeProperty("overflow");
      if (body.hasAttribute("data-scroll-locked")) body.removeAttribute("data-scroll-locked");
      if (document.documentElement.style.overflow === "hidden") {
        document.documentElement.style.removeProperty("overflow");
      }
    };

    const timer = setInterval(unstick, 700);
    const events: (keyof DocumentEventMap)[] = ["touchend", "touchcancel", "pointercancel", "visibilitychange"];
    const onEvent = () => setTimeout(unstick, 250);
    events.forEach((e) => document.addEventListener(e, onEvent, true));

    return () => {
      clearInterval(timer);
      events.forEach((e) => document.removeEventListener(e, onEvent, true));
    };
  }, []);

  return null;
}
