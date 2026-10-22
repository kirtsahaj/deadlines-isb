import { expect, it } from "vitest";
import { mergeDeadlines, titlesMatch, type MergeInput, type OutlineOccurrence, type OwnRow } from "../model";
const outline: OutlineOccurrence = { occurrence_id: "MKTS-PG-G", assessment_id: "PG", course_code: "MKTS", section_id: "MKTS_G", study_group_scope: null, title: "P&G India case report", date: "2026-10-23", time: "14:05", due_at: "2026-10-23T14:05:00+05:30", date_precision: "datetime", deadline_rule: "before_class", provisional: true, notification_ready: false, source_id: "outline", source_pages: null, status: "dated" };
const own: OwnRow = { id: "assignment1", title: "Procter &amp; Gamble India (Individual Assignment)", kind: "assignment", deadline_type: "due", deadline_status: "dated", submission_status: "unknown", due_at: outline.due_at, conflict: false, moodle_course_id: 11057, source_primary: "assign" };
const base: MergeInput = { now: Date.parse("2026-10-22T10:00:00+05:30"), enrollments: [{ courseCode: "MKTS", sectionId: "MKTS_G", studyGroup: null }], courseTitles: { MKTS: "Marketing Strategy" }, outline: [outline], own: [own], ownCourses: [{ moodle_course_id: 11057, short_name: "MKTS_PGPMOH_2026-27_T5", full_name: "Marketing Strategy" }], ownLastSuccessAt: "2026-10-22T09:00:00+05:30", shared: [] };
it("merges the screenshot's P&G/Procter and Gamble assessment and notification identities", () => {
  const rows = mergeDeadlines(base);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.notifyKeys).toEqual(["assignment1", "MKTS-PG-G"]);
  expect(rows[0]?.sources).toHaveLength(2);
});
it("does not collapse different assessment numbers or generic labels", () => {
  expect(titlesMatch("P&G India case 1", "Procter & Gamble India assignment 2")).toBe(false);
  expect(titlesMatch("Individual Assignment", "Case report")).toBe(false);
  expect(titlesMatch("P&G India case", "Rosewood case report")).toBe(false);
});
it("keeps different courses, sections and far-away occurrences separate", () => {
  expect(mergeDeadlines({ ...base, ownCourses: [{ ...base.ownCourses[0], moodle_course_id: 11057, short_name: "MKTS_PGPMOH_2026-27_T4", full_name: "Marketing" }] })).toHaveLength(2);
  expect(mergeDeadlines({ ...base, own: [{ ...own, title: "Procter & Gamble India (Section H)" }] })).toHaveLength(2);
  expect(mergeDeadlines({ ...base, own: [{ ...own, due_at: "2026-11-20T14:05:00+05:30" }] })).toHaveLength(2);
});
it("leaves ambiguous matches separate instead of choosing the first", () => {
  expect(mergeDeadlines({ ...base, outline: [outline, { ...outline, occurrence_id: "second" }] })).toHaveLength(3);
});
it("preserves separate hard cutoffs and due dates", () => {
  const rows = mergeDeadlines({ ...base, own: [{ ...own, id: "cutoff", deadline_type: "cutoff" }, own] });
  expect(rows).toHaveLength(2);
  expect(rows.find(r => r.deadlineType === "due")?.outline?.occurrence_id).toBe("MKTS-PG-G");
  expect(rows.find(r => r.deadlineType === "cutoff")?.outline).toBeUndefined();
});
it("keeps visible date conflicts when the same assessment moves", () => {
  const rows = mergeDeadlines({ ...base, own: [{ ...own, due_at: "2026-10-24T14:05:00+05:30" }] });
  expect(rows).toHaveLength(1);
  expect(rows[0]?.conflict).toBe(true);
});