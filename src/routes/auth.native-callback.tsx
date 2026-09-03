import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { completeOAuthFromUrl } from "@/lib/browser-google";

export const Route = createFileRoute("/auth/native-callback")({
  ssr: false,
  component: NativeCallback,
  head: () => ({
    meta: [
      { title: "Google লগইন সম্পূর্ণ হচ্ছে — Good-App" },
      {
        name: "description",
        content: "Google দিয়ে সাইন-ইন সম্পূর্ণ হচ্ছে। এক মুহূর্ত অপেক্ষা করুন, তারপর অ্যাপে ফিরে যাবেন।",
      },
      { property: "og:title", content: "Google লগইন সম্পূর্ণ হচ্ছে — Good-App" },
      { property: "og:description", content: "Google সাইন-ইন প্রক্রিয়া শেষ হচ্ছে।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function NativeCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await completeOAuthFromUrl(window.location.href);
      if (!alive) return;
      if (r.ok) window.location.replace("/home");
      else setError(r.error ?? "লগইন সম্পূর্ণ হয়নি");
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-3xl p-6 text-center space-y-3">
        <h1 className="text-base font-black text-navy">
          {error ? "লগইন সম্পূর্ণ হয়নি" : "লগইন সম্পূর্ণ হচ্ছে…"}
        </h1>
        {error ? (
          <>
            <p className="text-xs text-muted-foreground font-bold">{error}</p>
            <a
              href="/auth"
              className="inline-flex w-full items-center justify-center rounded-xl gradient-cta px-4 py-3 text-sm font-black text-white btn-press"
            >
              আবার চেষ্টা করুন
            </a>
          </>
        ) : (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan" />
        )}
      </div>
    </main>
  );
}
