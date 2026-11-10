import { useMemo, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAdminMetrics, getIntakeHealth, getJobDigestFeedUrl, type AdminUserRow } from "@/lib/admin.functions";
import { relativeTime } from "@/lib/format";
import { useSession } from "@/lib/useSession";
import { isAdminEmail } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — ISB Deadline Tracker" },
      { name: "description", content: "Private usage dashboard for the ISB Deadline Tracker." },
      { property: "og:title", content: "Admin — ISB Deadline Tracker" },
      { property: "og:description", content: "Private usage dashboard for the ISB Deadline Tracker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const fmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function When({ value }: { value: string | null }) {
  return <span>{value ? fmt.format(new Date(value)) : "—"}</span>;
}

function Pair({ label, first, last }: { label: string; first: string | null; last: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">
        <When value={first} /> <span className="text-muted-foreground">→</span> <When value={last} />
      </p>
    </div>
  );
}

function AdminPage() {
  const { user } = useSession();
  const allowed = isAdminEmail(user?.email);
  const fetchMetrics = useServerFn(getAdminMetrics);
  const metrics = useQuery({ queryKey: ["admin-metrics"], queryFn: () => fetchMetrics(), enabled: allowed });
  const fetchIntake = useServerFn(getIntakeHealth);
  const intake = useQuery({ queryKey: ["admin-intake"], queryFn: () => fetchIntake(), enabled: allowed });
  const fetchDigestFeed = useServerFn(getJobDigestFeedUrl);
  const digestFeed = useQuery({ queryKey: ["admin-digest-feed"], queryFn: () => fetchDigestFeed(), enabled: allowed, staleTime: Infinity });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "connected" | "not" | "notify">("all");

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (metrics.data?.rows ?? []).filter((r: AdminUserRow) => {
      if (filter === "connected" && !r.connected) return false;
      if (filter === "not" && r.connected) return false;
      if (filter === "notify" && r.notifyDevices === 0) return false;
      if (!q) return true;
      return `${r.name ?? ""} ${r.email ?? ""}`.toLowerCase().includes(q);
    });
  }, [metrics.data, query, filter]);

  if (user && !allowed) return <Navigate to="/deadlines" replace />;

  const all = metrics.data?.rows ?? [];
  const dayAgo = Date.now() - 86_400_000;
  const stats = [
    { label: "Sign-ups", value: all.length },
    { label: "eLearn connected", value: all.filter((r) => r.connected).length },
    { label: "Opened in 24h", value: all.filter((r) => r.openedLast && new Date(r.openedLast).getTime() > dayAgo).length },
    { label: "Notifications on", value: all.filter((r) => r.notifyDevices > 0).length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">First → last time for each step. Times in IST.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { void metrics.refetch(); void intake.refetch(); }} disabled={metrics.isFetching}>
          {metrics.isFetching ? "Loading…" : "Reload"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="surface-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="font-display text-2xl font-semibold">{metrics.data ? s.value : "…"}</p>
          </div>
        ))}
      </div>

      <IntakeCard data={intake.data} failed={intake.isError} />

      <section className="surface-card space-y-2 p-4" aria-label="Job digest feed">
        <h2 className="text-base font-semibold">Job digest feed</h2>
        <p className="text-sm text-muted-foreground">
          Private RSS link for the 10 PM Outlook automation (job applications closing in the next 24 hours). Keep it private.
        </p>
        <Input readOnly value={digestFeed.data?.url ?? "Loading…"} onFocus={(e) => e.currentTarget.select()} aria-label="Job digest feed URL" />
      </section>

      <Link to="/admin/mail" className="surface-card flex items-center justify-between p-4 text-sm font-semibold">
        Mail opt-outs <span aria-hidden>→</span>
      </Link>

      <Link to="/admin/portal" className="surface-card flex items-center justify-between p-4 text-sm font-semibold">
        Portal check <span aria-hidden>→</span>
      </Link>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        {(["all", "connected", "not", "notify"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "connected" ? "Connected" : f === "not" ? "Not connected" : "Notifications on"}
          </Button>
        ))}
      </div>

      {metrics.isError && <p className="text-sm text-destructive">Couldn't load the dashboard.</p>}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.userId} className="surface-card space-y-3 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{r.name ?? "Unnamed"}</p>
                <p className="truncate text-xs text-muted-foreground">{r.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {r.notifyDevices > 0 && (
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">Notifications on</span>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    r.connected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.connected ? "Connected" : "Not connected"}
                </span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Pair label="Microsoft sign-in" first={r.signInFirst} last={r.signInLast} />
              <Pair label="Opened app" first={r.openedFirst} last={r.openedLast} />
              <Pair label="eLearn linked" first={r.connectedFirst} last={r.connectedLast} />
              <Pair label={`Synced (${r.syncCount} runs)`} first={r.syncFirst} last={r.syncLast} />
            </div>
            {r.connected && (
              <p className="text-xs text-muted-foreground">
                Last sync result: {r.syncLastOutcome ?? "—"} · Last successful refresh:{" "}
                <When value={r.successfulSyncLast} />
              </p>
            )}
            {(r.notifyDevices > 0 || r.jobAlertsOff) && (
              <p className="text-xs text-muted-foreground">
                {[
                  r.notifyDevices > 0 ? `Notifications on ${r.notifyDevices} device${r.notifyDevices === 1 ? "" : "s"}` : null,
                  r.jobAlertsOff ? "Job alerts off" : null,
                ].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        ))}
        {metrics.data && rows.length === 0 && <p className="text-sm text-muted-foreground">No matching students.</p>}
      </div>
    </div>
  );
}

type IntakeData = Awaited<ReturnType<typeof getIntakeHealth>>;

const INTAKE_COUNTS: [keyof IntakeData["counts"], string][] = [
  ["added", "Added"],
  ["updated", "Updated"],
  ["noChange", "No change"],
  ["ignored", "Ignored"],
  ["rejected", "Rejected"],
  ["attention", "Needs attention"],
];

/** Placements email intake: heartbeat, last 7 days, and emails to re-forward from Outlook. */
function IntakeCard({ data, failed }: { data: IntakeData | undefined; failed: boolean }) {
  return (
    <section className="surface-card space-y-3 p-4" aria-label="Placements email intake">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Placements email intake</h2>
        <p className="text-xs text-muted-foreground">Last 7 days</p>
      </div>
      {failed ? (
        <p className="text-sm text-destructive">Couldn't load intake health.</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Last forwarded email</p>
              <p className="text-sm">
                {data.lastForwardedAt ? (
                  <>
                    {relativeTime(data.lastForwardedAt)} · <When value={data.lastForwardedAt} />
                  </>
                ) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Last new job</p>
              <p className="text-sm">
                {data.lastNewJobAt ? (
                  <>
                    {relativeTime(data.lastNewJobAt)} · <When value={data.lastNewJobAt} />
                  </>
                ) : "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {INTAKE_COUNTS.map(([key, label]) => (
              <span
                key={key}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  (key === "rejected" || key === "attention") && data.counts[key] > 0
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {label} {data.counts[key]}
              </span>
            ))}
          </div>
          {data.problems.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Needs a look (re-forward from Outlook if a job is missing)</p>
              <ul className="space-y-1.5">
                {data.problems.map((p) => (
                  <li key={p.id} className="rounded-lg bg-muted/60 p-2 text-sm">
                    <p className="font-medium">{p.subject ?? "Subject unknown (failed before it could be read)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.label} · <When value={p.receivedAt} />
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No problems in the last 7 days.</p>
          )}
        </>
      )}
    </section>
  );
}
