import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while the next screen loads, so a tap never looks stuck. */
function PageSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}

export const getRouter = () => {
  // Data counts as fresh for 2 minutes, so switching tabs doesn't re-download everything;
  // kept for a day so the saved copy (lib/queryPersist) covers every tab.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 2 * 60_000, gcTime: 24 * 3600_000 } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultPendingComponent: PageSkeleton,
  });

  return router;
};
