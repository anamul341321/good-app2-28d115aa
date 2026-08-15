import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MessengerNav } from "@/components/messenger/MessengerNav";

export const Route = createFileRoute("/_authenticated/social")({
  component: SocialLayout,
});

function SocialLayout() {
  return (
    <div className="min-h-screen bg-gray-100 social-root">
      <Outlet />
      <MessengerNav />
    </div>
  );
}
