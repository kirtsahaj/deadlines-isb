import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, Bell, BellOff, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getJobJdLink, listJobs, setJobReminders, type JobTile } from "@/lib/jobs.functions";
import { jobsInView, type JobSort } from "@/lib/jobs/view";
import { isLive } from "@/lib/jobs/intake";
import { relativeTime } from "@/lib/format";
import { currentSubscription, enableReminders, pushSupport } from "@/lib/pushClient";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/placements")({
  head: () => ({
    meta: [
      { title: "Placements — ISB Deadline Tracker" },
      { name: "description", content: "Job openings from CAS broadcast emails with application deadlines and shortlist dates." },
      { property: "og:title", content: "Placements — ISB Deadline Tracker" },
      { property: "og:description", content: "CAS job openings, application deadlines and shortlist dates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlacementsPage,
});

function formatDate(date: string | null, time?: string | null): string {
  if (!date) return time ? `${time} (date not stated)` : "Not stated";
  const d = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", weekday: "short", timeZone: "UTC" });
  if (!time) return d;
  const [h, m] = time.split(":").map(Number);
  const t = new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return `${d}, ${t}`;
}

const addedLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

function JobCard({ job }: { job: JobTile }) {
  const jd = useMutation({
    mutationFn: () => getJobJdLink({ data: { jobId: job.id } }),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
  });

  return (
    <article className="surface-card relative space-y-1 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{job.company}</p>
        <p className="shrink-0 text-xs text-muted-foreground">Added {addedLabel(job.addedAt)}</p>
      </div>
      <h2 className="text-base font-semibold leading-snug">{job.role}</h2>
      <dl className="grid gap-x-3 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Apply by</dt>
        <dd>{formatDate(job.deadlineDate, job.deadlineTime)}</dd>
        <dt className="text-muted-foreground">Expected shortlist</dt>
        <dd>{formatDate(job.shortlistDate)}</dd>
      </dl>
      {job.hasJd && (
        <Button
          variant="outline"
          size="sm"
          className="absolute bottom-3 right-3 h-6 gap-1 rounded-full px-2.5 text-xs"
          onClick={() => jd.mutate()}
          disabled={jd.isPending}
          title="Open job description"
          aria-label={`Open job description for ${job.role}`}
        >
          <ExternalLink className="size-3" aria-hidden />
          {jd.isPending ? "…" : "JD"}
        </Button>
      )}
      {jd.isError && <p className="text-xs text-destructive">Couldn't open the file. Try again.</p>}
    </article>
  );
}

/**
 * One tap toggles new-job alerts and "apply by" reminders for the account (all devices).
 * It counts as on only when this device can actually receive them; turning it on asks for
 * notification permission first when needed. Assignment and class reminders are unaffected.
 */
function JobAlertsBell({ accountOn }: { accountOn: boolean | undefined }) {
  const queryClient = useQueryClient();
  const [deviceOn, setDeviceOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void currentSubscription()
      .catch(() => null)
      .then((sub) => setDeviceOn(!!sub && "Notification" in window && Notification.permission === "granted"));
  }, []);
  const on = !!accountOn && !!deviceOn;

  async function save(enabled: boolean) {
    await setJobReminders({ data: { enabled } });
    queryClient.setQueryData(["jobs"], (old: Awaited<ReturnType<typeof listJobs>> | undefined) =>
      old ? { ...old, jobReminders: enabled } : old,
    );
  }

  async function toggle() {
    setBusy(true);
    try {
      if (on) {
        await save(false);
        toast("Job alerts off");
        return;
      }
      if (!deviceOn) {
        const support = pushSupport();
        if (support === "needs-home-screen") return void toast("Add the app to your home screen to get job alerts");
        if (support === "unsupported") return void toast("This browser can't show notifications");
        const result = await enableReminders();
        if (result === "denied") return void toast("Notifications are blocked. Allow them in your settings, then try again.");
        if (result !== "enabled") return void toast("Couldn't turn on notifications. Please try again.");
        setDeviceOn(true);
      }
      if (!accountOn) await save(true);
      toast("Job alerts on");
    } catch {
      toast("Couldn't change job alerts. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const Icon = on ? Bell : BellOff;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 shrink-0 rounded-full bg-card text-muted-foreground"
      onClick={toggle}
      disabled={busy || accountOn === undefined || deviceOn === null}
      aria-pressed={on}
      aria-label={on ? "Job alerts on. Tap to turn off" : "Job alerts off. Tap to turn on"}
      title={on ? "Job alerts on" : "Job alerts off"}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}

const SORTS: { value: JobSort; label: string }[] = [
  { value: "deadline", label: "Deadline" },
  { value: "added", label: "Added on" },
];

function PlacementsPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<JobSort>("deadline");
  const isMobile = useIsMobile();
  // Refresh every minute while the tab is open, so new postings appear without leaving the page.
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => listJobs(), refetchInterval: 60_000 });
  const visible = useMemo(
    () => jobsInView(jobs.data?.jobs ?? [], { view: "upcoming", sort, filter: "all", search, now: Date.now() }),
    [jobs.data, search, sort],
  );

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-3xl font-semibold">Placements</h1>
        {jobs.data?.lastNewPostingAt && (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            {isLive(jobs.data.lastForwardedAt, Date.now()) && (
              <>
                <span className="size-2 rounded-full bg-success" aria-hidden />
              </>
            )}
            Last new posting {relativeTime(jobs.data.lastNewPostingAt)}
          </p>
        )}
      </header>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isMobile ? "Search" : "Search company or role"} aria-label="Search jobs" className="h-10 border-border bg-card pl-9" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 gap-1.5 rounded-full bg-card px-3"
              aria-label={`Sort by ${SORTS.find((o) => o.value === sort)?.label}`}
            >
              <ArrowUpDown className="size-4 text-muted-foreground" aria-hidden />
              {SORTS.find((o) => o.value === sort)?.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SORTS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={sort === option.value}
                onCheckedChange={() => setSort(option.value)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <JobAlertsBell accountOn={jobs.data?.jobReminders} />
      </div>

      {jobs.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : jobs.isError ? (
        <div className="surface-card p-6 text-center text-sm text-muted-foreground">Couldn't load jobs just now. Please try again.</div>
      ) : visible.length === 0 ? (
        <div className="surface-card p-6 text-center">
          <h2 className="text-base font-semibold">No upcoming deadlines</h2>
          {search && <p className="mt-1 text-sm text-muted-foreground">Nothing matches your search.</p>}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
