/** Warm "soon" pills for Assignments (via dueSoon in term5/model), Placements and Classes. */
export type SoonPill = { label: string; tone: "soon" | "urgent" | "now" };

const H = 3600_000;
const M = 60_000;

function countdown(prefix: string, left: number) {
  return left >= H ? `${prefix} in ${Math.floor(left / H)}h` : `${prefix} in ${Math.max(1, Math.floor(left / M))}m`;
}

/** Calendar date in India (YYYY-MM-DD). */
const istDate = (ms: number) => new Date(ms + 5.5 * H).toISOString().slice(0, 10);
const tomorrowIst = (now: number) => istDate(Date.parse(`${istDate(now)}T12:00:00Z`) + 24 * H);

/**
 * Deadlines with an exact time:
 * - within 24h: "Due in 5h" (minutes in the last hour)
 * - more than 24h away but dated tomorrow (India time): "Due tomorrow"
 * Red in the last 12h, amber before that. Anything further out shows nothing.
 */
export function deadlinePill(prefix: "Due" | "Closes", dueAt: string | null, now: number): SoonPill | null {
  if (!dueAt) return null;
  const due = Date.parse(dueAt);
  const left = due - now;
  if (!(left > 0)) return null;
  if (left <= 24 * H) return { label: countdown(prefix, left), tone: left <= 12 * H ? "urgent" : "soon" };
  if (istDate(due) === tomorrowIst(now)) return { label: `${prefix} tomorrow`, tone: "soon" };
  return null;
}

/** Jobs: exact times as above; date-only deadlines get "Closes tomorrow" (amber) and "Closes today" (red). */
export function jobClosing(job: { deadlineAt: string | null; deadlineDate: string | null }, now: number): SoonPill | null {
  if (job.deadlineAt) return deadlinePill("Closes", job.deadlineAt, now);
  if (job.deadlineDate === istDate(now)) return { label: "Closes today", tone: "urgent" };
  if (job.deadlineDate === tomorrowIst(now)) return { label: "Closes tomorrow", tone: "soon" };
  return null;
}

/** Amber within 6h of the start, red in the last 30 min, "On now" while the class runs. */
export function classStarting(c: { startsAt: string; endsAt: string }, now: number): SoonPill | null {
  const start = Date.parse(c.startsAt);
  const end = Date.parse(c.endsAt);
  if (now >= start && now < end) return { label: "On now", tone: "now" };
  const left = start - now;
  if (!(left > 0 && left <= 6 * H)) return null;
  return { label: countdown("Starts", left), tone: left <= 30 * M ? "urgent" : "soon" };
}
