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
  return new Date(now + minutes * 60_000).toISOString();
}