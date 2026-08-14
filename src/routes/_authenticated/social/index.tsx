import { createFileRoute } from "@tanstack/react-router";
import { NewsFeedPage } from "@/components/social/NewsFeedPage";
import { useQuery } from "@tanstack/react-query";
import { getAppStatus } from "@/lib/app-status.functions";
import { MaintenanceScreen } from "@/components/MaintenanceGate";

export const Route = createFileRoute("/_authenticated/social/")({
  component: SocialHome,
  head: () => ({
    meta: [
      { title: "Good-App Social · নিউজ ফিড" },
      { name: "description", content: "Good-App Social এ বন্ধুদের সাথে যুক্ত হন, পোস্ট করুন এবং মেসেঞ্জারে কথা বলুন।" },
      { property: "og:title", content: "Good-App Social" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function SocialHome() {
  const { data: appStatus } = useQuery({
    queryKey: ["app-status"],
    queryFn: () => getAppStatus(),
    staleTime: 30_000,
  });

  if (appStatus?.maintenance) return <MaintenanceScreen message={appStatus.message} />;

  return <NewsFeedPage />;
}
