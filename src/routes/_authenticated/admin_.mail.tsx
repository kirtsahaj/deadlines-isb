import { useMemo, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMailOptOuts, type MailOptOutRow } from "@/lib/admin.functions";
import { useSession } from "@/lib/useSession";
import { isAdminEmail } from "@/lib/admin";

/** Owner only: who unsubscribed from the daily mails or hid their birthday. Read-only. */
export const Route = createFileRoute("/_authenticated/admin_/mail")({
  head: () => ({
    meta: [
      { title: "Mail opt-outs — ISB Deadline Tracker" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MailOptOutsPage,
});

const fmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const KINDS: { key: "jobs" | "birthday" | "hideBirthday"; label: string }[] = [
  { key: "jobs", label: "Job digest" },
  { key: "birthday", label: "Birthday mail" },
  { key: "hideBirthday", label: "Birthday hidden" },
];

function MailOptOutsPage() {
  const { user } = useSession();
  const allowed = isAdminEmail(user?.email);
  const fetchOptOuts = useServerFn(getMailOptOuts);
  const optOuts = useQuery({ queryKey: ["admin-mail-optouts"], queryFn: () => fetchOptOuts(), enabled: allowed });
  const [query, setQuery] = useState("");

  const all = optOuts.data?.rows ?? [];
  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return all;
    return all.filter((r: MailOptOutRow) => `${r.name} ${r.email}`.toLowerCase().includes(q));
  }, [all, query]);

  if (user && !allowed) return <Navigate to="/deadlines" replace />;

  const stats = [
    { label: "Left the job digest", value: all.filter((r) => r.jobs).length },
    { label: "Left the birthday mail", value: all.filter((r) => r.birthday).length },
    { label: "Birthdays hidden", value: all.filter((r) => r.hideBirthday).length },
    { label: "People", value: all.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/admin" className="text-sm text-muted-foreground underline">
            ← Admin
          </Link>
          <h1 className="font-display text-2xl font-semibold">Mail opt-outs</h1>
          <p className="text-sm text-muted-foreground">Unsubscribes and hidden birthdays from the email preferences page. Times in IST.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void optOuts.refetch()} disabled={optOuts.isFetching}>
          {optOuts.isFetching ? "Loading…" : "Reload"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="surface-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="font-display text-2xl font-semibold">{optOuts.data ? s.value : "…"}</p>
          </div>
        ))}
      </div>

      <Input placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />

      {optOuts.isError && <p className="text-sm text-destructive">Couldn't load the opt-outs.</p>}
      {optOuts.data && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{all.length ? "No one matches that search." : "No one has opted out yet."}</p>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.email} className="surface-card space-y-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  {r.name}
                  {r.campus && <span className="ml-2 text-xs font-normal text-muted-foreground">{r.campus}</span>}
                </p>
                <p className="break-all text-xs text-muted-foreground">{r.email}</p>
              </div>
            </div>
            <ul className="flex flex-wrap gap-2">
              {KINDS.filter((k) => r[k.key]).map((k) => (
                <li key={k.key} className="rounded-full border border-border px-2.5 py-0.5 text-xs">
                  {k.label} <span className="text-muted-foreground">· {fmt.format(new Date(r[k.key]!))}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
