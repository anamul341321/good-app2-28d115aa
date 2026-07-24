import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Good-App | Face Verify ও Reward" },
      { name: "description", content: "Good-App-এ নিরাপদ face verification, reward, referral ও mining সুবিধা নিন।" },
      { property: "og:title", content: "Good-App | Face Verify ও Reward" },
      { property: "og:description", content: "নিরাপদ face verification, reward, referral ও mining সুবিধার প্ল্যাটফর্ম।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});
