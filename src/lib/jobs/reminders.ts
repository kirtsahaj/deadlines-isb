import { jobsForDigest, type DigestJob } from "./digest";

/**
 * Job application reminders are two daily summaries, not one notice per job:
 * - night (10 PM IST, with the mail): the same jobs as the 10 PM digest mail
 *   (exact deadlines in the next 24h + date-only jobs closing tomorrow);
 * - morning (8 AM IST): jobs with an exact deadline later today. Date-only jobs are
 *   left out, as in the mail: they are covered only the night before.
 * Each summary is sent once per user per day; the scheduler runs every 15 minutes,
 * so a window (not an exact minute) decides when it is due.
 */
export type JobSummaryKind = "night" | "morning";
const H = 60 * 60_000;
const IST_OFFSET = 5.5 * H;
const istHour = (now: number) => new Date(now + IST_OFFSET).getUTCHours();
const istDate = (ms: number) => new Date(ms + IST_OFFSET).toISOString().slice(0, 10);

/** Which summary is due now: night from 10 PM to midnight, morning from 8 to 10 AM (IST). */
export function dueJobSummary(now: number): JobSummaryKind | null {
  const h = istHour(now);
  if (h >= 22) return "night";
  if (h >= 8 && h < 10) return "morning";
  return null;
}

/** One claim per user, kind and IST day. */
export function jobSummaryClaim(kind: JobSummaryKind, now: number): { key: string; dueAt: string } {
  const day = istDate(now);
  return { key: `jobsummary:${kind}`, dueAt: new Date(`${day}T${kind === "night" ? "22" : "08"}:00:00+05:30`).toISOString() };
}

const timeLabel = (ms: number) =>
  new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(ms);

function companies(names: string[], max = 5): string {
  const unique = [...new Set(names)];
  return unique.length > max ? `${unique.slice(0, max).join(", ")} +${unique.length - max} more` : unique.join(", ");
}

/** The notification for a summary, or null when nothing closes (then nothing is sent). */
export function jobSummaryMessage(kind: JobSummaryKind, jobs: DigestJob[], now: number): { title: string; body: string } | null {
  if (kind === "night") {
    const due = jobsForDigest(jobs, now);
    if (!due.length) return null;
    return { title: `${due.length} job application${due.length === 1 ? "" : "s"} closing in the next 24 hours`, body: companies(due.map((j) => j.company)) };
  }
  const today = istDate(now);
  const due = jobs
    .filter((j) => j.deadlineAt && Date.parse(j.deadlineAt) > now && istDate(Date.parse(j.deadlineAt)) === today)
    .sort((a, b) => Date.parse(a.deadlineAt!) - Date.parse(b.deadlineAt!) || a.company.localeCompare(b.company));
  if (!due.length) return null;
  const items = due.map((j) => `${j.company} ${timeLabel(Date.parse(j.deadlineAt!))}`);
  const body = items.length > 5 ? `${items.slice(0, 5).join(", ")} +${items.length - 5} more` : items.join(", ");
  return { title: `${due.length} application${due.length === 1 ? "" : "s"} close${due.length === 1 ? "s" : ""} today`, body };
}

/** A new posting is announced only while its deadline can still be met; date-only deadlines count until day end (IST). */
export function newJobWorthAnnouncing(deadline: { date?: string; time?: string } | undefined, now: number): boolean {
  if (!deadline?.date) return true;
  const end = Date.parse(`${deadline.date}T${deadline.time ?? "23:59"}:00+05:30`);
  return !Number.isFinite(end) || end > now;
}

/** Job alerts default to on; only an explicit "off" (the Placements bell) opts a user out. */
export function jobAlertsOn(userIds: string[], settings: { user_id: string; job_reminders: boolean | null }[]): string[] {
  const off = new Set(settings.filter((s) => s.job_reminders === false).map((s) => s.user_id));
  return userIds.filter((id) => !off.has(id));
}
