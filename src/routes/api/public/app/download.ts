import { createFileRoute } from "@tanstack/react-router";

/**
 * অ্যাপ (APK) ডাউনলোড লিংক। Storage bucket private, তাই এখানে প্রতিবার
 * নতুন signed URL বানিয়ে redirect করা হয় — ইউজারের লিংক কখনো expire হয় না।
 */
export const Route = createFileRoute("/api/public/app/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const testMode = url.searchParams.get("test") === "1";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        
        let query = supabaseAdmin.from("bonus_settings").select("apk_url, apk_version, test_apk_url, test_apk_version");
        const { data: settings } = await query.eq("id", "default").maybeSingle();
        const path = testMode ? ((settings as any)?.test_apk_url || (settings as any)?.apk_url) : (settings as any)?.apk_url;
        const version = testMode ? ((settings as any)?.test_apk_version || (settings as any)?.apk_version || "test") : ((settings as any)?.apk_version ?? "latest");
        if (!path) return new Response("APK এখনো আপলোড করা হয়নি", { status: 404 });

        // A stale URL must never download an older object after a new release.
        // The requested file marker is informational; the database path remains
        // the only source of truth for which APK is currently active.
        const requestedUrl = new URL(request.url);
        void requestedUrl.searchParams.get("file");

        // Full URL saved by admin (e.g. Play Store link) → just redirect.
        if (/^https?:\/\//i.test(path)) {
          if (requestedUrl.searchParams.get("resolve") === "1") {
            return Response.json(
              { downloadUrl: path, fileName: `Good-App-v${version}.apk`, version },
              { headers: { "cache-control": "no-store" } },
            );
          }
          return new Response(null, {
            status: 302,
            headers: {
              location: path,
              "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
              pragma: "no-cache",
              expires: "0",
            },
          });
        }

        const { data, error } = await supabaseAdmin.storage
          .from("app-releases")
          .createSignedUrl(path, 60 * 10, { download: `Good-App-v${version}.apk` });
        if (error || !data?.signedUrl) {
          return new Response("ডাউনলোড লিংক তৈরি করা যায়নি", { status: 500 });
        }
        if (requestedUrl.searchParams.get("resolve") === "1") {
          return Response.json(
            { downloadUrl: data.signedUrl, fileName: `Good-App-v${version}.apk`, version },
            { headers: { "cache-control": "no-store" } },
          );
        }
        return new Response(null, {
          status: 302,
          headers: {
            location: data.signedUrl,
            "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
            pragma: "no-cache",
            expires: "0",
          },
        });
      },
    },
  },
});
