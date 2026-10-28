import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppFooter } from "@/components/AppShell";
import { useSession } from "@/lib/useSession";
import { lovable } from "@/integrations/lovable/index";
import { getAccessPolicy } from "@/lib/elearn.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ISB Deadline Tracker — every coursework deadline in one place" },
      { name: "description", content: "Assignments, classes & prereads and CAS job postings, all in one place. For ISB students." },
      { property: "og:title", content: "ISB Deadline Tracker" },
      { property: "og:description", content: "Assignments, classes & prereads and CAS job postings, all in one place. For ISB students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});


function Landing() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: policy } = useQuery({
    queryKey: ["access-policy"],
    queryFn: () => getAccessPolicy(),
  });

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/deadlines", replace: true });
  }, [loading, session, navigate]);

  async function signIn() {
    setSigningIn(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("microsoft", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Sign-in didn't complete. Please try again.");
      setSigningIn(false);
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/deadlines", replace: true });
  }

  const domains = policy?.allowedDomains ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <div className="max-w-2xl">
          <CalendarClock className="mb-8 size-12 text-foreground" aria-hidden />
          <p className="text-xs font-semibold uppercase text-muted-foreground">For ISB students</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">ISB Deadline Tracker<span className="text-accent">.</span></h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">All your academic and job application deadlines in one place.</p>
          <div className="mt-8 space-y-3">
            <Button size="lg" className="tap-target w-full sm:w-auto" onClick={signIn} disabled={signingIn || loading}>{signingIn ? "Opening Microsoft…" : "Continue with Microsoft"}</Button>
            {domains.length > 0 && <p className="text-xs text-muted-foreground">Use your {domains.map((domain) => `@${domain}`).join(" or ")} account.</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8">
        <AppFooter />
      </footer>
    </div>
  );
}
