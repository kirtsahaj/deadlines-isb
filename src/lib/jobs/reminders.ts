/** Job application reminders: 3 hours before an explicit deadline time, like course deadlines. */
export const JOB_REMINDER_OFFSETS_H = [3] as const;
const H = 60 * 60_000;

/** Offsets due right now. Date-only deadlines (no instant) and passed deadlines never qualify. */
export function dueJobOffsets(deadlineAt: string | null, now: number): number[] {
  if (!deadlineAt) return [];
  const left = new Date(deadlineAt).getTime() - now;
  if (!Number.isFinite(left) || left <= 0) return [];
  return left <= 3 * H ? [3] : [];
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
