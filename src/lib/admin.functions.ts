import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminEmail } from "./admin";

export type AdminUserRow = {
  userId: string;
  name: string | null;
  email: string | null;
  signInFirst: string | null;
  signInLast: string | null;
  openedFirst: string | null;
  openedLast: string | null;
  connected: boolean;
  connectionStatus: string | null;
  connectedFirst: string | null;
  connectedLast: string | null;
  syncFirst: string | null;
  syncLast: string | null;
  syncLastOutcome: string | null;
  successfulSyncLast: string | null;
  syncCount: number;
  /** Devices with notifications turned on (saved push subscriptions). */
  notifyDevices: number;
  /** Turned job alerts off with the Placements bell. */
  jobAlertsOff: boolean;
};

function minMax(acc: { min: string | null; max: string | null }, value: string | null) {
  if (!value) return acc;
  if (!acc.min || value < acc.min) acc.min = value;
  if (!acc.max || value > acc.max) acc.max = value;
  return acc;
}

export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: unknown })?.email;
    if (!isAdminEmail(typeof email === "string" ? email : "")) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The database returns at most 1,000 rows per request, so read every sync run in pages.
    const readAllRuns = async () => {
      const out: { user_id: string; started_at: string; outcome: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabaseAdmin
          .from("sync_runs")
          .select("user_id, started_at, outcome")
          .order("started_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + 999);
        if (error) throw new Error("runs_unavailable");
        out.push(...(data ?? []));
        if (!data || data.length < 1000) return out;
      }
    };

    const [usersRes, profilesRes, connRes, runRows, subsRes, settingsRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("user_id, display_name, first_opened_at, last_active_at"),
      supabaseAdmin
        .from("elearn_connections")
        .select("user_id, status, external_full_name, created_at, updated_at, last_success_at"),
      readAllRuns(),
      supabaseAdmin.from("push_subscriptions").select("user_id").limit(20000),
      supabaseAdmin.from("user_settings").select("user_id, job_reminders"),
    ]);
    if (usersRes.error) throw new Error("users_unavailable");

    const profiles = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));
    const conns = new Map((connRes.data ?? []).map((c) => [c.user_id, c]));
    const runs = new Map<string, { min: string | null; max: string | null; last: string | null; count: number }>();
    for (const r of runRows) {
      const entry = runs.get(r.user_id) ?? { min: null, max: null, last: null, count: 0 };
      minMax(entry, r.started_at);
      entry.last = r.outcome;
      entry.count += 1;
      runs.set(r.user_id, entry);
    }
    const devices = new Map<string, number>();
    for (const s of subsRes.data ?? []) devices.set(s.user_id, (devices.get(s.user_id) ?? 0) + 1);
    const jobAlertsOff = new Set((settingsRes.data ?? []).filter((s) => s.job_reminders === false).map((s) => s.user_id));

    const rows: AdminUserRow[] = usersRes.data.users.map((u) => {
      const p = profiles.get(u.id);
      const c = conns.get(u.id);
      const r = runs.get(u.id);
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const metaName = typeof meta['full_name'] === "string" ? meta['full_name'] : typeof meta['name'] === "string" ? meta['name'] : null;
      return {
        userId: u.id,
        name: p?.display_name ?? metaName ?? c?.external_full_name ?? null,
        email: u.email ?? null,
        signInFirst: u.created_at ?? null,
        signInLast: u.last_sign_in_at ?? null,
        openedFirst: p?.first_opened_at ?? null,
        openedLast: p?.last_active_at ?? null,
        connected: !!c,
        connectionStatus: c?.status ?? null,
        connectedFirst: c?.created_at ?? null,
        connectedLast: c?.updated_at ?? null,
        syncFirst: r?.min ?? null,
        syncLast: r?.max ?? null,
        syncLastOutcome: r?.last ?? null,
        successfulSyncLast: c?.last_success_at ?? null,
        syncCount: r?.count ?? 0,
        notifyDevices: devices.get(u.id) ?? 0,
        jobAlertsOff: jobAlertsOff.has(u.id),
      };
    });
    rows.sort((a, b) => (b.signInLast ?? "").localeCompare(a.signInLast ?? ""));
    return { rows, generatedAt: new Date().toISOString() };
  });

/** Placements email intake health for the owner: heartbeat, last 7 days and recent problems. */
export const getIntakeHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: unknown })?.email;
    if (!isAdminEmail(typeof email === "string" ? email : "")) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { FORWARDED_FILTER, intakeSummary, problemLabel } = await import("./jobs/intake");
    const now = Date.now();
    const [{ data: last }, { data: lastJob }, { data: week }] = await Promise.all([
      supabaseAdmin.from("job_inbound_messages").select("received_at").or(FORWARDED_FILTER)
        .order("received_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("jobs").select("first_seen_at").order("first_seen_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("job_inbound_messages").select("id, status, reason, subject, received_at")
        .gt("received_at", new Date(now - 7 * 86400_000).toISOString()).order("received_at", { ascending: false }).limit(1000),
    ]);
    const { counts, problems } = intakeSummary(week ?? [], now);
    return {
      lastForwardedAt: last?.received_at ?? null,
      lastNewJobAt: lastJob?.first_seen_at ?? null,
      counts,
      problems: problems.slice(0, 10).map((p) => ({ id: p.id, receivedAt: p.received_at, subject: p.subject, label: problemLabel(p) })),
    };
  });

/** Owner only: the private feed URL for the 10 PM Outlook job-digest automation. */
export const getJobDigestFeedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: unknown })?.email;
    if (!isAdminEmail(typeof email === "string" ? email : "")) throw new Error("forbidden");
    const { jobDigestKey } = await import("@/lib/jobs/digest.server");
    return { url: `https://deadlines-isb.lovable.app/api/public/job-digest?key=${await jobDigestKey()}` };
  });

export type MailOptOutRow = {
  email: string;
  name: string;
  campus: "Mohali" | "Hyderabad" | null;
  jobs: string | null;
  birthday: string | null;
  hideBirthday: string | null;
  latest: string;
};

/** "vinay_rane_pgp2027@isb.edu" → "Vinay Rane" when the class list has no name. */
function nameFromEmail(email: string) {
  return email
    .split("@")[0]!
    .replace(/_pgp\d+$/i, "")
    .split(/[_.]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Owner only: who left the daily mails or hid their birthday (email_unsubscribes). */
export const getMailOptOuts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: unknown })?.email;
    if (!isAdminEmail(typeof email === "string" ? email : "")) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { campusFor } = await import("@/lib/term5/catalog.server");
    const { data: opts, error } = await supabaseAdmin.from("email_unsubscribes").select("email, mail, created_at");
    if (error) throw new Error("optouts_unavailable");
    const emails = [...new Set((opts ?? []).map((o) => o.email.toLowerCase()))];
    const { data: people } = emails.length
      ? await supabaseAdmin.from("birthdays").select("email, name, campus").in("email", emails)
      : { data: [] as { email: string; name: string; campus: string }[] };
    const known = new Map((people ?? []).map((p) => [p.email.toLowerCase(), p]));

    const byEmail = new Map<string, MailOptOutRow>();
    for (const o of opts ?? []) {
      const key = o.email.toLowerCase();
      let row = byEmail.get(key);
      if (!row) {
        const p = known.get(key);
        const c = campusFor(key);
        row = {
          email: key,
          name: p?.name ?? nameFromEmail(key),
          campus: (p?.campus as MailOptOutRow["campus"]) ?? (c === "MOH" ? "Mohali" : c === "HYD" ? "Hyderabad" : null),
          jobs: null,
          birthday: null,
          hideBirthday: null,
          latest: o.created_at,
        };
        byEmail.set(key, row);
      }
      if (o.mail === "jobs") row.jobs = o.created_at;
      else if (o.mail === "birthday") row.birthday = o.created_at;
      else if (o.mail === "hide_birthday") row.hideBirthday = o.created_at;
      if (o.created_at > row.latest) row.latest = o.created_at;
    }
    return { rows: [...byEmail.values()].sort((a, b) => b.latest.localeCompare(a.latest)) };
  });
