import { createFileRoute } from "@tanstack/react-router";
import { NewsFeedPage } from "@/components/social/NewsFeedPage";
import { useQuery } from "@tanstack/react-query";
import { getAppStatus } from "@/lib/app-status.functions";
import { MaintenanceScreen } from "@/components/MaintenanceGate";


function HomePage() {
  const { data: appStatus } = useQuery({
    queryKey: ["app-status"],
    queryFn: () => getAppStatus(),
    staleTime: 30_000,
  });

  if (appStatus?.maintenance) return <MaintenanceScreen message={appStatus.message} />;

  return <NewsFeedPage />;
}

