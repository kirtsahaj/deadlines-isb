import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarClock, CalendarDays, ListChecks, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { useTerm5 } from "@/lib/useTerm5";

const NAV = [
  { to: "/deadlines", label: "Deadlines", icon: ListChecks },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/menu", label: "Menu", icon: Menu },
] as const;

export function AppFooter() {
  return (
    <p className="text-xs text-muted-foreground">
      Unofficial student tool. Read-only. Verify critical deadlines in eLearn.
    </p>
  );
}

/** Exactly three icon-only destinations with accessible names. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const term5 = useTerm5();
  const nav = term5.data && !term5.data.inRoster ? NAV.filter((n) => n.to !== "/schedule") : NAV;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-2">
          <Link to="/deadlines" className="mr-auto flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarClock className="size-4" aria-hidden />
            </span>
            <span className="font-display text-sm font-semibold sm:text-base">ISB Deadline Tracker</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4">{children}</main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-24">
        <AppFooter />
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label="Main"
      >
        <div className="mx-auto flex max-w-md">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className="tap-target flex flex-1 items-center justify-center py-3"
              >
                <span
                  className={`grid h-9 w-14 place-items-center rounded-full transition-colors ${
                    active ? item.to === "/schedule" ? "bg-preread/15 text-preread" : "bg-primary/15 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
