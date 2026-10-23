import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarClock, Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/jobs.functions";
import { useTerm5 } from "@/lib/useTerm5";
import { navTabs } from "@/lib/navTabs";

const SEEN_KEY = "placements-seen-v1";

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
  const tabs = navTabs(term5);
  const menuActive = pathname === "/menu";
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => listJobs(), enabled: tabs.length > 0 });
  const jobIds = (jobs.data?.jobs ?? []).map((j) => j.id);
  const [seen, setSeen] = useState<Set<string> | null>(null);
  useEffect(() => {
    try { setSeen(new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"))); } catch { setSeen(new Set()); }
  }, []);
  useEffect(() => {
    if (pathname !== "/placements" || !jobs.data) return;
    localStorage.setItem(SEEN_KEY, JSON.stringify(jobIds));
    setSeen(new Set(jobIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, jobs.data]);
  const hasNewJobs = !!seen && pathname !== "/placements" && jobIds.some((id) => !seen.has(id));

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
          <div className="flex gap-1 rounded-full border border-border bg-muted/90 p-1 shadow-xl ring-1 ring-foreground/5 backdrop-blur-md dark:bg-secondary/90 dark:ring-foreground/10">
            {tabs.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => {
                    try {
                      if ("vibrate" in navigator) navigator.vibrate(10);
                    } catch {
                      /* haptics unsupported */
                    }
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`tap-target relative rounded-full ${tabs.length > 2 ? "px-4" : "px-5"} py-2.5 text-sm font-semibold transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                  {item.to === "/placements" && hasNewJobs && (
                    <span aria-label="New postings" className="absolute right-1.5 top-1 size-2 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
