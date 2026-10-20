export const SYNC_BUDGET_MS = 20_000;
export const SYNC_LEASE_MS = 120_000;

export function hasFreshDeadlineSources(status: Record<string, { ok: boolean }>): boolean {
  return ["assignments", "quizzes", "forums", "calendar"].some((name) => status[name]?.ok);
}

export function mayRemoveMissing(complete: boolean): boolean {
  // An incomplete snapshot must never hide previously usable deadlines.
  return complete;
}

export function nextRefreshAt(now: number, minutes: number): string {
  // Scheduler delivery is staggered. Remove seconds so its next half-hour
  // tick cannot fall a few seconds before the account's due timestamp.
  return new Date(Math.floor(now / 60_000) * 60_000 + minutes * 60_000).toISOString();
}
export const SYNC_CYCLE_MINUTES = 120;
export const SYNC_SLOT_MINUTES = 15;

/** Stable slot (0..cycle/slot-1) derived from the user id so accounts spread evenly. */
export function userSyncSlot(userId: string, cycle = SYNC_CYCLE_MINUTES, slot = SYNC_SLOT_MINUTES): number {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % Math.max(1, Math.floor(cycle / slot));
}

/** Next time on the user's slot that is at least half a cycle away. */
export function nextSlottedRefreshAt(now: number, userId: string, cycle = SYNC_CYCLE_MINUTES, slot = SYNC_SLOT_MINUTES): string {
  const cycleMs = cycle * 60_000;
  const offset = userSyncSlot(userId, cycle, slot) * slot * 60_000;
  const earliest = now + cycleMs / 2;
  let t = Math.floor(earliest / cycleMs) * cycleMs + offset;
  if (t < earliest) t += cycleMs;
  return new Date(t).toISOString();
}
