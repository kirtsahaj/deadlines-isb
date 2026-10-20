/** The only account allowed to see the admin dashboard. Checked server-side on every request. */
export const ADMIN_EMAIL = "kirt_singh_pgp2027@isb.edu";

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase().trim() === ADMIN_EMAIL;
}

/** App visits are written at most this often per user. */
export const VISIT_THROTTLE_MS = 5 * 60 * 1000;

export function shouldRecordVisit(lastActiveAt: string | null, now: number): boolean {
  if (!lastActiveAt) return true;
  return now - new Date(lastActiveAt).getTime() >= VISIT_THROTTLE_MS;
}
