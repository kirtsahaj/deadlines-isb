import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getJobJdLink, listJobs, type JobTile } from "@/lib/jobs.functions";
import { jobsInView } from "@/lib/jobs/view";
import { relativeTime } from "@/lib/format";

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

function JobCard({ job }: { job: JobTile }) {
  const jd = useMutation({
    mutationFn: () => getJobJdLink({ data: { jobId: job.id } }),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
  });

  return (
    <article className="surface-card space-y-1 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{job.company}</p>
      <h2 className="text-base font-semibold leading-snug">{job.role}</h2>
      <dl className="grid gap-x-3 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Apply by</dt>
        <dd>{formatDate(job.deadlineDate, job.deadlineTime)}</dd>
        <dt className="text-muted-foreground">Expected shortlist</dt>
        <dd>{formatDate(job.shortlistDate)}</dd>
      </dl>
      {job.hasJd && (
        <Button variant="outline" size="sm" className="mt-1 h-8 rounded-full" onClick={() => jd.mutate()} disabled={jd.isPending}>
          <Download className="size-3.5" aria-hidden /> {jd.isPending ? "Opening…" : "Job description"}
        </Button>
      )}
      {jd.isError && <p className="text-xs text-destructive">Couldn't open the file. Try again.</p>}
    </article>
  );
}

function PlacementsPage() {
  const [search, setSearch] = useState("");
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => listJobs() });
  const visible = useMemo(
    () => jobsInView(jobs.data?.jobs ?? [], { view: "upcoming", sort: "deadline", filter: "all", search, now: Date.now() }),
    [jobs.data, search],
  );

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-3xl font-semibold">Placements</h1>
        {jobs.data?.feedUpdatedAt && (
          <p className="mt-1 text-sm font-medium text-muted-foreground">Last updated {relativeTime(jobs.data.feedUpdatedAt)}</p>
        )}
        <p className="text-xs text-muted-foreground">Please refer to the placement portal for more info.</p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company or role" aria-label="Search jobs" className="h-10 border-border bg-card pl-9" />
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
