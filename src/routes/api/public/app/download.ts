import { createFileRoute } from "@tanstack/react-router";

/**
 * অ্যাপ (APK) ডাউনলোড লিংক। Storage bucket private, তাই এখানে প্রতিবার
 * নতুন signed URL বানিয়ে redirect করা হয় — ইউজারের লিংক কখনো expire হয় না।
 */
export const Route = createFileRoute("/api/public/app/download")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("bonus_settings")
          .select("apk_url")
          .eq("id", "default")
          .maybeSingle();
        const path = (settings as any)?.apk_url as string | null;
        if (!path) return new Response("APK এখনো আপলোড করা হয়নি", { status: 404 });

        // Full URL saved by admin (e.g. Play Store link) → just redirect.
        if (/^https?:\/\//i.test(path)) {
          return new Response(null, { status: 302, headers: { location: path } });
        }

        const { data, error } = await supabaseAdmin.storage
          .from("app-releases")
          .createSignedUrl(path, 60 * 30, { download: "Good-App.apk" });
        if (error || !data?.signedUrl) {
          return new Response("ডাউনলোড লিংক তৈরি করা যায়নি", { status: 500 });
        }
        return new Response(null, {
          status: 302,
          headers: { location: data.signedUrl, "cache-control": "no-store" },
        });
      },
    },
  },
});
