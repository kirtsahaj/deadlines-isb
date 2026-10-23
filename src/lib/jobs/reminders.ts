/** Job application reminders: 12 hours and 3 hours before an explicit deadline time. */
export const JOB_REMINDER_OFFSETS_H = [12, 3] as const;
/** The schedule ticks every 15 minutes; a missed 12-hour notice is never sent late as a catch-up. */
export const JOB_12H_WINDOW_MS = 20 * 60_000;
const H = 60 * 60_000;

/** Offsets due right now. Date-only deadlines (no instant) and passed deadlines never qualify. */
export function dueJobOffsets(deadlineAt: string | null, now: number): number[] {
  if (!deadlineAt) return [];
  const left = new Date(deadlineAt).getTime() - now;
  if (!Number.isFinite(left) || left <= 0) return [];
  if (left <= 3 * H) return [3];
  if (left <= 12 * H && left > 12 * H - JOB_12H_WINDOW_MS) return [12];
  return [];
}

export const jobReminderKey = (userId: string, jobId: string, dueAt: string, offset: number) =>
  `${userId}|${jobId}|${new Date(dueAt).toISOString()}|${offset}`;

export type PlannedJobReminder = { userId: string; jobId: string; dueAt: string; offset: number };

/** Every eligible user gets every due job; starring is not required. Already-claimed keys are skipped. */
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
