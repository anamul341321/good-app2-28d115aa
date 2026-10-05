import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Good-App" },
      { name: "description", content: "Good-App account, slot verification, rewards, send money, recharge and local withdrawal services." },
      { property: "og:title", content: "Good-App" },
      { property: "og:description", content: "Manage Good-App verification, rewards, transfers, recharge and local withdrawal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    throw redirect({ to: "/home" });
  },
});
