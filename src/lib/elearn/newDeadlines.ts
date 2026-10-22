export const MAX_NEW_DEADLINE_ALERTS = 3;

type Candidate = { external_key: string; due_at: string | null; title: string; moodle_course_id: number };

/** Deadlines first seen in this sync that are still upcoming; capped to avoid alert floods. */
export function selectNewDeadlineAlerts<T extends Candidate>(rows: T[], known: Set<string>, now: number): T[] {
  return rows
    .filter((r) => !known.has(r.external_key) && r.due_at && new Date(r.due_at).getTime() > now)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
    .slice(0, MAX_NEW_DEADLINE_ALERTS);
}
