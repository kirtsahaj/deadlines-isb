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