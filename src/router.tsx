import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Heavy-traffic app: avoid duplicate/burst network calls so the UI stays snappy.
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: 1,
        retryDelay: (attempt) => Math.min(1200 * 2 ** attempt, 4000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false,
        refetchIntervalInBackground: false,
        networkMode: "online",
      },
      mutations: { retry: 0, networkMode: "online" },
    },
  });


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
