/** Job application reminders: 12 hours and 3 hours before an explicit deadline time. */
export const JOB_REMINDER_OFFSETS_H = [12, 3] as const;
const H = 60 * 60_000;

/**
 * The offset due right now: 3 inside the last 3 hours, 12 between 12 and 3 hours out.
 * A job first seen inside 3 hours gets only the 3-hour notice (no late 12-hour one).
 * Date-only deadlines (no instant) and passed deadlines never qualify.
 */
export function dueJobOffsets(deadlineAt: string | null, now: number): number[] {
  if (!deadlineAt) return [];
  const left = new Date(deadlineAt).getTime() - now;
  if (!Number.isFinite(left) || left <= 0) return [];
  if (left <= 3 * H) return [3];
  if (left <= 12 * H) return [12];
  return [];
}

export const jobReminderKey = (userId: string, jobId: string, dueAt: string, offset: number) =>
  `${userId}|${jobId}|${new Date(dueAt).toISOString()}|${offset}`;

export type PlannedJobReminder = { userId: string; jobId: string; dueAt: string; offset: number };

/** Every eligible user gets every due job. Already-claimed keys are skipped. */
export function planJobReminders(
  jobs: { id: string; deadlineAt: string | null }[],
  userIds: string[],
  now: number,
  claimed: Set<string> = new Set(),
): PlannedJobReminder[] {
  const out: PlannedJobReminder[] = [];
  for (const job of jobs) {
    for (const offset of dueJobOffsets(job.deadlineAt, now)) {
      for (const userId of userIds) {
        const dueAt = new Date(job.deadlineAt!).toISOString();
        if (claimed.has(jobReminderKey(userId, job.id, dueAt, offset))) continue;
        out.push({ userId, jobId: job.id, dueAt, offset });
      }
    }
  }
  return out;
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
