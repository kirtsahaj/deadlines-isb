import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
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

function tap() {
  try {
    if ("vibrate" in navigator) navigator.vibrate(10);
  } catch {
    /* haptics unsupported */
  }
}

/**
 * No top bar: pages start with their own heading, padded for notches and status bars.
 * One floating bottom pill holds the text tabs plus a Menu icon at the end.
 */
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
  // Three tabs plus Menu must fit a 360px phone; tighten only on the smallest screens.
  const itemPadding = tabs.length > 2 ? "px-2.5 text-[13px] min-[400px]:px-3.5 min-[400px]:text-sm sm:px-4" : "px-5 text-sm";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main
        className="mx-auto w-full max-w-3xl flex-1 pb-28"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        {children}
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-32">
        <AppFooter />
      </footer>

      <nav
        className="fixed inset-x-0 z-20 flex justify-center px-3"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        aria-label="Main"
      >
        <div className="nav-pill flex items-center gap-0.5 rounded-full p-1 min-[400px]:gap-1">
          {tabs.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={tap}
                aria-current={active ? "page" : undefined}
                className={`nav-item tap-target relative rounded-full ${itemPadding} py-2.5 font-semibold transition-colors ${
                  active ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {item.label}
                {item.to === "/placements" && hasNewJobs && (
                  <span aria-label="New postings" className="absolute right-1.5 top-1 size-2 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
          {tabs.length > 0 && <span aria-hidden className="h-6 w-px shrink-0 bg-[var(--nav-border)] min-[400px]:mx-0.5" />}
          <Link
            to="/menu"
            onClick={tap}
            aria-label="Menu"
            title="Menu"
            aria-current={menuActive ? "page" : undefined}
            className={`nav-item tap-target grid size-10 place-items-center rounded-full transition-colors ${
              menuActive ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            <Menu className="size-5" aria-hidden />
          </Link>
        </div>
      </nav>
    </div>
  );
}
