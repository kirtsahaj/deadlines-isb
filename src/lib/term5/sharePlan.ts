import { sectionHintFromTitle, sharedCourseKey, term5CodeFromShortName, type Campus } from "./model";

type Row = { external_key: string; kind: string; deadline_type: string; title: string; due_at: string | null; moodle_course_id: number };

/** Only course-level academic deadline metadata is shared: no submissions, calendar user events, grades or identities. */
export const SHAREABLE_KINDS = new Set(["assignment", "quiz", "forum", "choice", "text"]);

export type SharedScope = { course_code: string; contributor_section: string };

/**
 * Pure: what one contributor's sync publishes to the section pool, and which course+section
 * pools that sync fully covers (their own-campus eLearn course and their class-list section).
 * After a complete sync, anything in a covered pool that this sync didn't confirm is gone from eLearn.
 */
export function planSharedPublish(
  rows: Row[],
  courses: Array<{ id: number; shortname: string | null }>,
  campus: Campus,
  mySections: Map<string, string | null>,
  now: string,
) {
  const codeById = new Map(courses.map((c) => [c.id, term5CodeFromShortName(c.shortname, campus)]));
  const scopes = new Map<string, SharedScope>();
  for (const code of codeById.values()) {
    const section = code ? mySections.get(code) : null;
    if (code && section) {
      const key = sharedCourseKey(campus, code);
      scopes.set(`${key}|${section}`, { course_code: key, contributor_section: section });
    }
  }
  const payload = rows.flatMap((r) => {
    const code = codeById.get(r.moodle_course_id);
    const section = code ? mySections.get(code) : null;
    if (!code || !section || !SHAREABLE_KINDS.has(r.kind)) return [];
    return [{
      course_code: sharedCourseKey(campus, code),
      source_key: r.external_key,
      contributor_section: section,
      section_hint: sectionHintFromTitle(r.title, campus),
      kind: r.kind,
      deadline_type: r.deadline_type,
      title: r.title,
      due_at: r.due_at,
      last_confirmed_at: now,
      active: true,
    }];
  });
  return { payload, scopes: [...scopes.values()] };
}
