import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ExternalLink, Search } from "lucide-react";
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
import { getJobJdLink, listJobs, type JobTile } from "@/lib/jobs.functions";
import { AlertsBell } from "@/components/AlertsBell";
import { ShareButton } from "@/components/ShareButton";
import { jobsInView, type JobSort } from "@/lib/jobs/view";
import { isLive } from "@/lib/jobs/intake";
import { jobClosing } from "@/lib/soon";
import { relativeTime } from "@/lib/format";
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

function JobCard({ job, isNew }: { job: JobTile; isNew: boolean }) {
  const jd = useMutation({
    mutationFn: () => getJobJdLink({ data: { jobId: job.id } }),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
  });
  const closing = jobClosing(job, Date.now());

  return (
    <article className="surface-card relative space-y-1 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{job.company}</p>
        <p className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {isNew && <span className="tile-new">New</span>}
          Added {addedLabel(job.addedAt)}
        </p>
      </div>
      <h2 className="text-base font-semibold leading-snug">{job.role}</h2>
      <dl className="grid gap-x-3 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Apply by</dt>
        <dd className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {formatDate(job.deadlineDate, job.deadlineTime)}
          {closing && <span className={`tile-soon ${closing.tone === "urgent" ? "tile-soon-urgent" : closing.tone === "later" ? "tile-soon-later" : ""}`}>{closing.label}</span>}
        </dd>
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

const SORTS: { value: JobSort; label: string }[] = [
  { value: "deadline", label: "Deadline" },
  { value: "added", label: "Added on" },
];

function PlacementsPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<JobSort>("deadline");
  // Jobs seen at the previous visit (the bottom bar updates this list once Placements opens).
  const [previouslySeen] = useState<Set<string> | null>(() => {
    try {
      const raw = window.localStorage.getItem("placements-seen-v1");
      return raw ? new Set(JSON.parse(raw) as string[]) : null;
    } catch {
      return null;
    }
  });
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
        <div className="flex items-start gap-2">
          <h1 className="mr-auto min-w-0 text-3xl font-semibold">Placements</h1>
          <ShareButton />
        </div>
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
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isMobile ? "Search" : "Search company or role"} aria-label="Search jobs" className="h-10 border-transparent bg-muted pl-9 shadow-none focus:border-border focus:bg-card focus-visible:ring-0" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 gap-1.5 rounded-full border-transparent bg-muted px-3 shadow-none hover:bg-muted/70"
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
        <AlertsBell category="jobs" />
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
              <JobCard job={job} isNew={!!previouslySeen && !previouslySeen.has(job.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
