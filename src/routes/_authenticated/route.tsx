import { useEffect } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/lib/useSession";
import { supabase } from "@/integrations/supabase/client";
import { getAccountAccess } from "@/lib/elearn.functions";

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
    if (!loading && !session) void navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  const access = useQuery({
    queryKey: ["account-access", session?.user.id],
    queryFn: () => getAccountAccess(),
    enabled: !!session,
  });

  if (loading || !session || access.isLoading) {
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
    <AppShell isAdmin={!!access.data?.isAdmin}>
      <Outlet />
    </AppShell>
  );
}
