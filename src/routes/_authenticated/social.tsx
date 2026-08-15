import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/social")({
  component: SocialLayout,
});

function SocialLayout() {
  return (
    <div className="min-h-screen bg-background messenger-theme">
      <Outlet />
    </div>
  );
}

