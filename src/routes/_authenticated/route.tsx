import { useEffect, useRef } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/lib/useSession";
import { supabase } from "@/integrations/supabase/client";
import { getAccountAccess } from "@/lib/elearn.functions";
import { clearPersistedQueryCache, persistQueryCache, restoreQueryCache } from "@/lib/queryPersist";

// Once a phone has passed the school-account check, later opens don't wait on it.
const ACCESS_OK_KEY = "account-access-ok-v1";
function accessRemembered(userId: string) {
  try {
    return window.localStorage.getItem(ACCESS_OK_KEY) === userId;
  } catch {
    return false;
  }
}
function rememberAccess(userId: string | null) {
  try {
    if (userId) window.localStorage.setItem(ACCESS_OK_KEY, userId);
    else window.localStorage.removeItem(ACCESS_OK_KEY);
  } catch {
    /* this visit only */
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface-card max-w-md space-y-4 p-6 text-center">{children}</div>
    </div>
  );
}

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !session) {
      clearPersistedQueryCache();
      rememberAccess(null);
      void navigate({ to: "/", replace: true });
    }
  }, [loading, session, navigate]);

  // Show last time's data straight away (restored before any screen asks for it), then keep it saved.
  const userId = session?.user.id ?? null;
  const restoredFor = useRef<string | null>(null);
  if (userId && restoredFor.current !== userId) {
    restoredFor.current = userId;
    restoreQueryCache(queryClient, userId);
  }
  useEffect(() => {
    if (!userId) return;
    return persistQueryCache(queryClient, userId);
  }, [userId, queryClient]);

  const access = useQuery({
    queryKey: ["account-access", session?.user.id],
    queryFn: () => getAccountAccess(),
    enabled: !!session,
  });

  useEffect(() => {
    if (!userId || !access.data) return;
    rememberAccess(access.data.allowed ? userId : null);
  }, [userId, access.data]);

  if (loading || !session || (access.isLoading && !accessRemembered(session.user.id))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (access.data && !access.data.allowed) {
    const domains = access.data.allowedDomains.map((domain) => `@${domain}`).join(" or ");
    return (
      <Centered>
        <h1 className="text-xl font-semibold">This tracker is for students only</h1>
        <p className="text-sm text-muted-foreground">
          You signed in as {access.data.email || "an unrecognised account"}. Please sign in again
          with your school account{domains ? ` (${domains})` : ""}.
        </p>
        <Button
          onClick={async () => {
            await queryClient.cancelQueries();
            queryClient.clear();
            clearPersistedQueryCache();
            rememberAccess(null);
            await supabase.auth.signOut();
            void navigate({ to: "/", replace: true });
          }}
        >
          Sign in with a different account
        </Button>
      </Centered>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
