import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getPortalCheck } from "@/lib/admin.functions";
import { useSession } from "@/lib/useSession";
import { isAdminEmail } from "@/lib/admin";

/** Owner only: the daily 8 PM / 9 PM portal check — status and change log. Read-only. */
export const Route = createFileRoute("/_authenticated/admin_/portal")({
  head: () => ({ meta: [{ title: "Portal check — ISB Deadline Tracker" }, { name: "robots", content: "noindex" }] }),
  component: PortalCheckPage,
});

const fmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const deadline = (s: string | null) => {
  if (!s) return "—";
  const ms = Date.parse(`${s.slice(0, 10)}T${s.length > 10 ? s.slice(11) : "12:00"}:00+05:30`);
  if (!Number.isFinite(ms)) return s;
  const day = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).format(ms);
  return s.length > 10 ? `${day}, ${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(ms)}` : day;
};
const ERRORS: Record<string, string> = {
  no_token: "No portal token saved",
  token_rejected: "Token not accepted (expired, revoked or logged out)",
  portal_unreachable: "Portal could not be reached",
  unexpected_response: "Portal answered in an unexpected format",
};
const ACTIONS: Record<string, { label: string; tone: string }> = {
  added: { label: "Added", tone: "text-emerald-700 dark:text-emerald-400" },
  deadline: { label: "Deadline updated", tone: "text-primary" },
  hidden: { label: "Hidden", tone: "text-amber-700 dark:text-amber-400" },
  unhidden: { label: "Back", tone: "text-emerald-700 dark:text-emerald-400" },
  skipped: { label: "Skipped (PPO/PPI)", tone: "text-muted-foreground" },
  failed: { label: "Check failed", tone: "text-destructive" },
};

function PortalCheckPage() {
  const { user } = useSession();
  const allowed = isAdminEmail(user?.email);
  const fetchCheck = useServerFn(getPortalCheck);
  const q = useQuery({ queryKey: ["admin-portal-check"], queryFn: () => fetchCheck(), enabled: allowed });
  if (user && !allowed) return <Navigate to="/deadlines" replace />;

  const last = q.data?.runs[0];
  const lastOk = q.data?.runs.find((r) => r.ok);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/admin" className="text-sm text-muted-foreground underline">
            ← Admin
          </Link>
          <h1 className="font-display text-2xl font-semibold">Portal check</h1>
          <p className="text-sm text-muted-foreground">Daily at 8 PM and 9 PM: the app's upcoming jobs are matched to the portal's active list. Times in IST.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
          {q.isFetching ? "Loading…" : "Reload"}
        </Button>
      </div>

      {q.isError && <p className="text-sm text-destructive">Couldn't load the portal check.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Last check</p>
          <p className="font-display text-lg font-semibold">{last ? fmt.format(new Date(last.ran_at)) : q.data ? "Not run yet" : "…"}</p>
          {last && <p className="text-xs text-muted-foreground">{last.slot === "8pm" ? "8 PM reading" : "9 PM reading"}</p>}
        </div>
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className={`font-display text-lg font-semibold ${last && !last.ok ? "text-destructive" : ""}`}>
            {!q.data ? "…" : !last ? "—" : last.ok ? "Worked" : "Failed"}
          </p>
          {last && !last.ok && <p className="text-xs text-destructive">{ERRORS[last.error ?? ""] ?? last.error}</p>}
        </div>
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Active on portal</p>
          <p className="font-display text-lg font-semibold">{lastOk?.active_count ?? (q.data ? "—" : "…")}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Portal token</p>
          <p className={`font-display text-lg font-semibold ${q.data && !q.data.tokenSaved ? "text-destructive" : ""}`}>
            {!q.data ? "…" : q.data.tokenSaved ? "Saved" : "Missing"}
          </p>
        </div>
      </div>

      <section className="space-y-3" aria-label="Change log">
        <h2 className="text-base font-semibold">Change log</h2>
        {q.data && q.data.changes.length === 0 && <p className="text-sm text-muted-foreground">No changes yet.</p>}
        {q.data?.changes.map((c) => {
          const a = ACTIONS[c.action] ?? { label: c.action, tone: "" };
          return (
            <article key={c.id} className="surface-card space-y-1 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={`text-xs font-semibold uppercase tracking-wide ${a.tone}`}>{a.label}</p>
                <p className="text-xs text-muted-foreground">{fmt.format(new Date(c.created_at))}</p>
              </div>
              {c.company && (
                <p className="text-sm">
                  <span className="font-semibold">{c.company}</span>
                  {c.role ? ` – ${c.role}` : ""}
                </p>
              )}
              {(c.old_deadline || c.new_deadline) && (
                <p className="text-xs text-muted-foreground">
                  {c.action === "deadline" ? `${deadline(c.old_deadline)} → ${deadline(c.new_deadline)}` : `Closes ${deadline(c.new_deadline ?? c.old_deadline)}`}
                </p>
              )}
              {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
            </article>
          );
        })}
      </section>
    </div>
  );
}
