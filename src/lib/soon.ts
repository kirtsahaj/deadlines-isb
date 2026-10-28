/** Warm "soon" pills for Placements and Classes (Assignments uses dueSoon in term5/model). */
export type SoonPill = { label: string; tone: "soon" | "urgent" | "now" };

const H = 3600_000;
const M = 60_000;

function countdown(prefix: string, left: number) {
  return left >= H ? `${prefix} in ${Math.floor(left / H)}h` : `${prefix} in ${Math.max(1, Math.floor(left / M))}m`;
}

const todayIst = (now: number) => new Date(now + 5.5 * H).toISOString().slice(0, 10);

/** Amber within 24h of the apply-by time, red in the last 3h; date-only deadlines get "Closes today". */
export function jobClosing(job: { deadlineAt: string | null; deadlineDate: string | null }, now: number): SoonPill | null {
  if (job.deadlineAt) {
    const left = Date.parse(job.deadlineAt) - now;
    if (!(left > 0 && left <= 24 * H)) return null;
    return { label: countdown("Closes", left), tone: left <= 3 * H ? "urgent" : "soon" };
  }
  if (job.deadlineDate && job.deadlineDate === todayIst(now)) return { label: "Closes today", tone: "soon" };
  return null;
}

/** Amber within 3h of the start, red in the last 30 min, "On now" while the class runs. */
export function classStarting(c: { startsAt: string; endsAt: string }, now: number): SoonPill | null {
  const start = Date.parse(c.startsAt);
  const end = Date.parse(c.endsAt);
  if (now >= start && now < end) return { label: "On now", tone: "now" };
  const left = start - now;
  if (!(left > 0 && left <= 3 * H)) return null;
  return { label: countdown("Starts", left), tone: left <= 30 * M ? "urgent" : "soon" };
}
