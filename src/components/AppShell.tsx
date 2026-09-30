import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, LifeBuoy, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/deadlines", label: "Deadlines", icon: CalendarClock },
  { to: "/help", label: "Help", icon: LifeBuoy },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppFooter() {
  return (
    <p className="text-xs text-muted-foreground">
      Unofficial student tool. Read-only. Verify critical deadlines in eLearn.
    </p>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3">
          <Link to="/deadlines" className="mr-auto flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarClock className="size-4" aria-hidden />
            </span>
            <span className="font-display text-base font-semibold">ISB Deadline Tracker</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            {NAV.map((item) => (
              <Button
                key={item.to}
                asChild
                variant={pathname === item.to ? "secondary" : "ghost"}
                size="sm"
              >
                <Link to={item.to}>{item.label}</Link>
              </Button>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="tap-target">
            <LogOut className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only sm:ml-1">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:pb-12">{children}</main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-24 sm:pb-8">
        <AppFooter />
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur sm:hidden"
        aria-label="Main"
      >
        <div className="flex">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`tap-target flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs ${
                  active ? "text-accent" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
