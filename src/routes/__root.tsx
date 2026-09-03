import { AppUpdateBanner } from "@/components/AppUpdateBanner";
import { ForceUpdateGate } from "@/components/ForceUpdateGate";

import { SplashScreen } from "@/components/SplashScreen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LanguageProvider } from "@/lib/i18n";
import { useNativeApp } from "@/hooks/useNativeApp";
import { NativeAdsController } from "@/components/NativeAdsController";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page nai</h2>
        <p className="mt-2 text-sm text-muted-foreground">Ei page khuje paini.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md gradient-cta px-4 py-2 text-sm font-bold">
            Home a jan
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold">Page load hoini</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md gradient-cta px-4 py-2 text-sm font-bold">
            Abar chesta korun
          </button>
          <a href="/" className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-bold">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Good-App" },
      { name: "description", content: "Good-App — নিরাপদ ফেস ভেরিফিকেশন ও রিওয়ার্ড প্ল্যাটফর্ম" },
      { name: "theme-color", content: "#0ea5a4" },
      { name: "google", content: "notranslate" },
      { httpEquiv: "Content-Language", content: "bn" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Good-App" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "Good-App" },
      { name: "twitter:title", content: "Good-App" },
      { property: "og:description", content: "Good-App — নিরাপদ ফেস ভেরিফিকেশন ও রিওয়ার্ড প্ল্যাটফর্ম" },
      { name: "twitter:description", content: "Good-App — নিরাপদ ফেস ভেরিফিকেশন ও রিওয়ার্ড প্ল্যাটফর্ম" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@300;400;500;600;700;800;900&family=Baloo+Da+2:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" },
    ],
    // Monetag ট্যাগ শুধু পাবলিক/মার্কেটিং পেজে চলে (RootComponent-এ inject হয়),
    // তাই অ্যাপের ভেতরের বাটনে ক্লিক আর অ্যাডে হাইজ্যাক হয় না।
    scripts: [],


  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" translate="no" className="notranslate">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Exclude admin and social routes from update gates
  const isExcludedRoute = /^\/(admin|admin-login|social|chat|feed|friends|videos|reels|watch|studio|channel|user|profile)(\/|$)/.test(pathname);

  useNativeApp();

  useEffect(() => {
    // Only Vignette zones: full-screen ad with a close button, highest payout,
    // and it never sits on top of app buttons.
    // In-Page Push (11713181) and the old Multitag (OnClick/Popunder) stay OFF —
    // they covered the UI / hijacked clicks and paid very little.
    document
      .querySelectorAll(
        'script[data-zone="275797"], script[src*="quge5.com/88/tag.min.js"], script[data-zone="11713181"], script[src*="nap5k.com"]',
      )
      .forEach((node) => node.remove());
    if (pathname.startsWith("/admin")) return;

    const ownNodes = new Set<Element>(Array.from(document.body.children));
    const vignetteZones = ["11713170", "11713348", "11713413"];

    // Session cap: এক session-এ সর্বোচ্চ ২৫ বার Vignette request পাঠাবো —
    // এতেই প্রতি ইউজার থেকে ২০-৩০ impression-এর কাছাকাছি সম্ভাবনা তৈরি হয়।
    const SESSION_KEY = "monetag_session_count";
    let sessionCount = 0;
    try {
      sessionCount = Number(sessionStorage.getItem(SESSION_KEY) || "0");
    } catch { /* ignore */ }
    const MAX_PER_SESSION = 25;

    // একসাথে ৩টি zone পাঠালে একটাই দেখা যায়, বাকি দুটো নষ্ট হয় (frequency cap)।
    // তাই এক বারে একটি zone — এবং প্রতিবার পরের zone-এ পালা করে যাবে।
    // ৬০ সেকেন্ড gap: প্রতিটি request আলাদা impression হিসেবে গোনার সুযোগ পায়
    // আর ইউজারও বিরক্ত হয় না।
    let zoneIndex = 0;
    const injectVignettes = () => {
      if (sessionCount >= MAX_PER_SESSION) return;
      sessionCount += 1;
      try {
        sessionStorage.setItem(SESSION_KEY, String(sessionCount));
      } catch { /* ignore */ }
      document
        .querySelectorAll('script[data-zone^="11713"][src*="n6wxm.com"], script.monetag-rotator')
        .forEach((node) => node.remove());
      const zone = vignetteZones[zoneIndex % vignetteZones.length]!;
      zoneIndex += 1;
      const s = document.createElement("script");
      s.className = "monetag-rotator";
      s.dataset.zone = zone;
      s.src = `https://n6wxm.com/vignette.min.js?_=${Date.now()}`;
      s.async = true;
      document.body.appendChild(s);
    };

    injectVignettes();
    const rotateTimer = window.setInterval(injectVignettes, 60_000);

    // Safety net: if any leftover small fixed ad box shows up, hide it instead of
    // letting it cover the top of the screen.
    const hideStrayBoxes = () => {
      Array.from(document.body.children).forEach((el) => {
        if (ownNodes.has(el) || el.tagName === "SCRIPT" || el.tagName === "STYLE") return;
        const node = el as HTMLElement;
        const style = window.getComputedStyle(node);
        if (style.position !== "fixed" || style.display === "none") return;
        const rect = node.getBoundingClientRect();
        if (rect.height > window.innerHeight * 0.5) return; // vignette — leave alone
        if (rect.top < window.innerHeight * 0.5) node.style.setProperty("display", "none", "important");
      });
    };
    const observer = new MutationObserver(hideStrayBoxes);
    observer.observe(document.body, { childList: true, subtree: true });
    const pinTimer = window.setInterval(hideStrayBoxes, 800);

    return () => {
      observer.disconnect();
      window.clearInterval(pinTimer);
      window.clearInterval(rotateTimer);
    };
  }, [pathname]);





  useEffect(() => {
    // Native Android WebView draws under the status bar; give it a slightly
    // larger top offset. Browsers keep the compact gap so pages look full-screen.
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) {
      document.documentElement.classList.add("native-shell");
    }
  }, []);

  useEffect(() => {
    // After a redeploy, old chunk hashes 404. Auto-reload once so users never
    // see the raw "Failed to fetch dynamically imported module" toast.
    const RELOAD_KEY = "__chunk_reload_at";
    const isChunkError = (msg: string) =>
      /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed/i.test(msg);
    const maybeReload = () => {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
      if (Date.now() - last < 10_000) return; // avoid loops
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    };
    const onErr = (e: ErrorEvent) => { if (isChunkError(e.message || "")) maybeReload(); };
    const onRej = (e: PromiseRejectionEvent) => {
      const msg = (e.reason && (e.reason.message || String(e.reason))) || "";
      if (isChunkError(msg)) maybeReload();
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <NativeAdsController />
        <SplashScreen />
        {!isExcludedRoute && <AppUpdateBanner />}
        {!isExcludedRoute && <ForceUpdateGate />}
        <Outlet />

        <Toaster theme="dark" position="top-center" richColors />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
