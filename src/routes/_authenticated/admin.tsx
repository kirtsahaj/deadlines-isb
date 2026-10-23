import { useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAdminMetrics, type AdminUserRow } from "@/lib/admin.functions";
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "connected" | "not">("all");

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (metrics.data?.rows ?? []).filter((r: AdminUserRow) => {
      if (filter === "connected" && !r.connected) return false;
      if (filter === "not" && r.connected) return false;
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
    { label: "Deadlines tracked", value: all.reduce((n, r) => n + r.activeDeadlines, 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">First → last time for each step. Times in IST.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void metrics.refetch()} disabled={metrics.isFetching}>
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

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        {(["all", "connected", "not"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "connected" ? "Connected" : "Not connected"}
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
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  r.connected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {r.connected ? "Connected" : "Not connected"}
              </span>
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
          </div>
        ))}
        {metrics.data && rows.length === 0 && <p className="text-sm text-muted-foreground">No matching students.</p>}
      </div>
    </div>
  );
}
