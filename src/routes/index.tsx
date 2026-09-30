import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Lock, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppFooter } from "@/components/AppShell";
import { useSession } from "@/lib/useSession";
import { lovable } from "@/integrations/lovable/index";
import { getAccessPolicy } from "@/lib/elearn.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ISB Deadline Tracker — every coursework deadline in one place" },
      {
        name: "description",
        content:
          "A read-only student tool that gathers assignment, quiz, forum and calendar deadlines from eLearn into one calm list.",
      },
      { property: "og:title", content: "ISB Deadline Tracker" },
      {
        property: "og:description",
        content: "See every eLearn coursework deadline in one calm, read-only list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: CalendarClock,
    title: "One list, every source",
    body: "Assignments, quizzes, forums, the course calendar and dates mentioned in course text — merged and de-duplicated.",
  },
  {
    icon: Lock,
    title: "Read-only by design",
    body: "No password is ever requested. The tracker can only read your coursework, never submit or change anything.",
  },
  {
    icon: RefreshCcw,
    title: "Kept fresh quietly",
    body: "Deadlines refresh in the background, and you can refresh manually whenever you want.",
  },
] as const;

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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              Unofficial student tool
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
              Every coursework deadline, in one calm list.
            </h1>
            <p className="mt-4 max-w-prose text-base text-muted-foreground">
              Connect your eLearn account once and see assignments, quizzes, forums and calendar
              dates together — with the source of every date shown, so you can trust what you see.
            </p>

            <div className="mt-8 space-y-3">
              <Button
                size="lg"
                className="tap-target w-full sm:w-auto"
                onClick={signIn}
                disabled={signingIn || loading}
              >
                {signingIn ? "Opening Microsoft…" : "Continue with Microsoft"}
              </Button>
              {domains.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Sign in with your school account
                  {` (${domains.map((domain) => `@${domain}`).join(" or ")})`}.
                </p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>

          <ul className="space-y-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.title} className="surface-card flex gap-3 p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">{feature.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8">
        <AppFooter />
      </footer>
    </div>
  );
}
