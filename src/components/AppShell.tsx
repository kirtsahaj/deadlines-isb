import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarClock, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { useTerm5 } from "@/lib/useTerm5";

const TABS = [
  { to: "/deadlines", label: "Assignments" },
  { to: "/schedule", label: "Prereads" },
] as const;

export function AppFooter() {
  return (
    <p className="text-xs text-muted-foreground">
      Unofficial student tool. Read-only. Verify critical deadlines in eLearn.
    </p>
  );
}

/** Menu sits top-right; Assignments and Prereads are text tabs in a floating bottom pill. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const term5 = useTerm5();
  const showPrereads = !!term5.data?.inRoster;
  const tabs = showPrereads ? TABS : [];
  const menuActive = pathname === "/menu";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-2">
          <Link to="/deadlines" className="mr-auto flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarClock className="size-4" aria-hidden />
            </span>
            <span className="font-display text-sm font-semibold sm:text-base">ISB Deadline Tracker</span>
          </Link>
          <Link
            to="/menu"
            aria-label="Menu"
            title="Menu"
            aria-current={menuActive ? "page" : undefined}
            className={`tap-target grid size-10 place-items-center rounded-full transition-colors ${
              menuActive ? "bg-primary/15 text-primary" : "text-foreground hover:bg-muted"
            }`}
          >
            <Menu className="size-5" aria-hidden />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4">{children}</main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-32">
        <AppFooter />
      </footer>

      {tabs.length > 0 && (
        <nav
          className="fixed inset-x-0 z-20 flex justify-center px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          aria-label="Main"
        >
          <div className="flex gap-1 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
            {tabs.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`tap-target rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
