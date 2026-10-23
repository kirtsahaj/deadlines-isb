import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getJobJdLink, listJobs, setJobReminders, setJobStar, type JobTile } from "@/lib/jobs.functions";
import { deadlinePassed, jobsInView, type JobFilter, type JobSort, type JobView } from "@/lib/jobs/view";
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

function JobCard({ job, now }: { job: JobTile; now: number }) {
  const queryClient = useQueryClient();
  const star = useMutation({
    mutationFn: (starred: boolean) => setJobStar({ data: { jobId: job.id, starred } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });
  const jd = useMutation({
    mutationFn: () => getJobJdLink({ data: { jobId: job.id } }),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
  });
  const starred = star.isPending ? !!star.variables : job.starred;
  const passed = deadlinePassed(job, now);

  return (
    <article className="surface-card flex gap-3 p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{job.company}</p>
        <h2 className="text-base font-semibold leading-snug">{job.role}</h2>
        <dl className="grid gap-x-3 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Apply by</dt>
          <dd>
            {formatDate(job.deadlineDate, job.deadlineTime)}
            {passed && <span className="text-muted-foreground"> · passed per email</span>}
          </dd>
          <dt className="text-muted-foreground">Expected shortlist</dt>
          <dd>{formatDate(job.shortlistDate)}</dd>
        </dl>
        {job.hasJd && (
          <Button variant="outline" size="sm" className="mt-1 h-8 rounded-full" onClick={() => jd.mutate()} disabled={jd.isPending}>
            <Download className="size-3.5" aria-hidden /> {jd.isPending ? "Opening…" : "Job description"}
          </Button>
        )}
        {jd.isError && <p className="text-xs text-destructive">Couldn't open the file. Try again.</p>}
      </div>
      <button
        type="button"
        aria-pressed={starred}
        aria-label={starred ? `Unstar ${job.role}` : `Star ${job.role}`}
        onClick={() => star.mutate(!starred)}
        className="tap-target grid size-10 shrink-0 place-items-center rounded-full hover:bg-muted"
      >
        <Star className={`size-5 ${starred ? "fill-primary text-primary" : "text-muted-foreground"}`} aria-hidden />
      </button>
    </article>
  );
}

function JobReminderToggle({ enabled }: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (value: boolean) => setJobReminders({ data: { enabled: value } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });
  if (enabled === undefined) return null;
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="text-sm">
        <span className="font-medium">Application deadline reminders</span>
        <span className="block text-muted-foreground">12 and 3 hours before, when the email gives a time. Uses your existing notification setting.</span>
      </span>
      <Switch checked={mutation.isPending ? mutation.variables : enabled} onCheckedChange={(v) => mutation.mutate(v)} aria-label="Application deadline reminders" />
    </label>
  );
}

function PlacementsPage() {
  const [view, setView] = useState<JobView>("upcoming");
  const [sort, setSort] = useState<JobSort>("deadline");
  const [filter, setFilter] = useState<JobFilter>("all");
  const [search, setSearch] = useState("");
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => listJobs() });
  const now = Date.now();
  const visible = useMemo(
    () => jobsInView(jobs.data?.jobs ?? [], { view, sort, filter, search, now }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobs.data, view, sort, filter, search],
  );

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-3xl font-semibold">Placements</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          From CAS emails{jobs.data?.feedUpdatedAt ? ` · last email ${relativeTime(jobs.data.feedUpdatedAt)}` : ""}. Not checked against the portal — confirm there before applying.
        </p>
      </header>

      <JobReminderToggle enabled={jobs.data?.jobReminders} />

      <div className="inline-flex rounded-full bg-muted p-1" role="tablist" aria-label="Job view">
        {(["upcoming", "older"] as JobView[]).map((value) => (
          <Button key={value} type="button" role="tab" aria-selected={view === value} variant={view === value ? "default" : "ghost"} size="sm" onClick={() => setView(value)}>
            {value === "upcoming" ? "Upcoming" : "Older"}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company or role" aria-label="Search jobs" className="h-10 border-border bg-card pl-9" />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as JobFilter)}>
          <SelectTrigger className="h-10 w-36 rounded-full bg-card px-4" aria-label="Filter jobs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All jobs</SelectItem>
            <SelectItem value="starred">Starred</SelectItem>
            <SelectItem value="jd">With JD</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as JobSort)}>
          <SelectTrigger className="h-10 w-40 rounded-full bg-card px-4" aria-label="Sort jobs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deadline">By deadline</SelectItem>
            <SelectItem value="recent">Recently updated</SelectItem>
          </SelectContent>
        </Select>
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
          <h2 className="text-base font-semibold">{view === "upcoming" ? "No open jobs" : "No older jobs"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{jobs.data?.jobs.length ? "Nothing matches your search or filter." : "New CAS job emails will appear here."}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((job) => (
            <li key={job.id}>
              <JobCard job={job} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
