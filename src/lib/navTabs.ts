export const ASSIGNMENTS = { to: "/deadlines", label: "Assignments" } as const;
export const CLASSES = { to: "/schedule", label: "Classes" } as const;
export const PLACEMENTS = { to: "/placements", label: "Placements" } as const;

/**
 * Bottom tabs: Assignments, Placements, then Classes (roster-only).
 * Until the roster answer has actually arrived (loading or failed), show no tabs,
 * as before Placements existed, so a roster student never sees a nav that looks
 * like Placements replaced Classes. Last good answer is kept across refetch errors.
 */
export function navTabs(term5: { data?: { inRoster: boolean } | undefined }) {
  if (!term5.data) return [];
  return term5.data.inRoster ? [ASSIGNMENTS, PLACEMENTS, CLASSES] : [ASSIGNMENTS, PLACEMENTS];
}
