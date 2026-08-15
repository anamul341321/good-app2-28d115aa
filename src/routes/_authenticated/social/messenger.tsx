import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAppStatus } from "@/lib/app-status.functions";
import { MaintenanceScreen } from "@/components/MaintenanceGate";
import { ChatListPage } from "@/routes/_authenticated/chat.index";

export const Route = createFileRoute("/_authenticated/social/messenger")({
  component: SocialMessenger,
  head: () => ({
    meta: [
      { title: "Good-App Social · মেসেঞ্জার" },
      { name: "description", content: "Good-App Social এ বন্ধুদের সাথে কথা বলুন।" },
      { property: "og:title", content: "মেসেঞ্জার · Good-App Social" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function SocialMessenger() {
  const { data: appStatus } = useQuery({
    queryKey: ["app-status"],
    queryFn: () => getAppStatus(),
    staleTime: 30_000,
  });

  if (appStatus?.maintenance) return <MaintenanceScreen message={appStatus.message} />;

  return (
    <div className="bg-background min-h-screen">
      <ChatListPage />
    </div>
  );
}
