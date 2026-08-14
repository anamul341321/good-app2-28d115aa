import { createFileRoute } from "@tanstack/react-router";
import { NewsFeedPage } from "@/components/social/NewsFeedPage";

export const Route = createFileRoute("/_authenticated/home")({
  component: NewsFeedPage,
});
