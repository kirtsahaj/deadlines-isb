import catalog from "./data/catalog.json";
import roster from "./data/roster.json";
import type { Enrollment } from "./model";

/** Server-only: the class list contains personal data and never ships to the browser. */
export type Catalog = typeof catalog;
export const term5Catalog = catalog;

type RosterRow = [string, string, string | number | null];
const rosterByEmail = roster as unknown as Record<string, RosterRow[]>;

export type Override = { course_code: string; section_id: string | null; removed: boolean };

export function rosterEnrollments(email: string): Enrollment[] {
  return (rosterByEmail[email.toLowerCase().trim()] ?? []).map(([courseCode, sectionId, studyGroup]) => ({
    courseCode,
    sectionId,
    studyGroup,
  }));
}

/** Roster is the default; self-service corrections replace or remove a course, or add one. */
export function resolveEnrollments(email: string, overrides: Override[]): { enrollments: Enrollment[]; inRoster: boolean } {
  const base = rosterEnrollments(email);
  const byCode = new Map(base.map((e) => [e.courseCode, e]));
  const validCodes = new Set(catalog.courses.map((c) => c.course_code));
  const validSections = new Set(catalog.sections.map((s) => s.section_id));
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
  return { enrollments: [...byCode.values()], inRoster: base.length > 0 };
}

export function courseTitles(): Record<string, string> {
  return Object.fromEntries(catalog.courses.map((c) => [c.course_code, c.title]));
}
