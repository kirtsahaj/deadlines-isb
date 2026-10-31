import catalog from "./data/catalog.json";
import roster from "./data/roster.json";
import hydCatalog from "./data/hyderabad-catalog.json";
import hydRoster from "./data/hyderabad-roster.json";
import type { Campus, Enrollment } from "./model";

/** Server-only: the class lists contain personal data and never ship to the browser. */
export type Catalog = typeof catalog;
/** Mohali catalog (kept for existing callers/tests). */
export const term5Catalog = catalog;

type RosterRow = [string, string, string | number | null];
const ROSTERS: Record<Campus, Record<string, RosterRow[]>> = {
  MOH: roster as unknown as Record<string, RosterRow[]>,
  HYD: hydRoster as unknown as Record<string, RosterRow[]>,
};
const CATALOGS: Record<Campus, Catalog> = { MOH: catalog, HYD: hydCatalog as unknown as Catalog };

export function catalogFor(campus: Campus): Catalog {
  return CATALOGS[campus];
}

/** Every address on a campus class list (lower-case), in list order. */
export function rosterEmails(campus: Campus): string[] {
  return Object.keys(ROSTERS[campus]).map((e) => e.toLowerCase().trim());
}

/** Campus comes from the private class lists, never from the email domain. */
export function campusFor(email: string): Campus | null {
  const key = email.toLowerCase().trim();
  if (ROSTERS.MOH[key]) return "MOH";
  if (ROSTERS.HYD[key]) return "HYD";
  return null;
}

export type Override = { course_code: string; section_id: string | null; removed: boolean };

export function rosterEnrollments(email: string, campus: Campus | null = campusFor(email)): Enrollment[] {
  if (!campus) return [];
  return (ROSTERS[campus][email.toLowerCase().trim()] ?? []).map(([courseCode, sectionId, studyGroup]) => ({
    courseCode,
    sectionId,
    studyGroup,
  }));
}

/** Roster is the default; self-service corrections replace or remove a course, or add one. */
export function resolveEnrollments(
  email: string,
  overrides: Override[],
): { enrollments: Enrollment[]; inRoster: boolean; campus: Campus | null } {
  const campus = campusFor(email);
  const cat = catalogFor(campus ?? "MOH");
  const base = rosterEnrollments(email, campus);
  const byCode = new Map(base.map((e) => [e.courseCode, e]));
  const validCodes = new Set(cat.courses.map((c) => c.course_code));
  const validSections = new Set(cat.sections.map((s) => s.section_id));
  for (const o of overrides) {
    if (!validCodes.has(o.course_code)) continue;
    if (o.removed) {
      byCode.delete(o.course_code);
      continue;
    }
    const sectionId = o.section_id && validSections.has(o.section_id) && o.section_id.startsWith(`${o.course_code}_`) ? o.section_id : null;
    const prev = byCode.get(o.course_code);
    byCode.set(o.course_code, {
      courseCode: o.course_code,
      sectionId,
      studyGroup: prev && prev.sectionId === sectionId ? prev.studyGroup : null,
    });
  }
  return { enrollments: [...byCode.values()], inRoster: base.length > 0, campus };
}

export function courseTitles(campus: Campus = "MOH"): Record<string, string> {
  return Object.fromEntries(catalogFor(campus).courses.map((c) => [c.course_code, c.title]));
}
