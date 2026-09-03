import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Good-App" },
      { name: "description", content: "Good-App Messenger, Reels, Stories and community." },
      { property: "og:title", content: "Good-App" },
      { property: "og:description", content: "Good-App Messenger, Reels, Stories and community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    throw redirect({ to: "/home" });
  },
});
