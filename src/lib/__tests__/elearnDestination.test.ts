import { expect, it } from "vitest";
import { elearnDestination } from "../elearnDestination";
import type { OwnRow } from "../term5/model";

const row = (changes: Partial<OwnRow> = {}): OwnRow => ({ id: "1", title: "Assignment", kind: "assignment", deadline_type: "due", deadline_status: "dated", submission_status: "unknown", due_at: null, conflict: false, moodle_course_id: 11057, source_primary: "assign", activity_id: 99, ...changes });
it("opens assignments with their instance parameter, not a module id", () => {
  expect(elearnDestination({ moodleCourseId: 11057, own: row() })).toEqual({ url: "https://elearn.isb.edu/mod/assign/view.php?a=99", activity: true });
});
it("uses the correct quiz and forum instance parameters", () => {
  expect(elearnDestination({ moodleCourseId: 11057, own: row({ kind: "quiz" }) })?.url).toBe("https://elearn.isb.edu/mod/quiz/view.php?q=99");
  expect(elearnDestination({ moodleCourseId: 11057, own: row({ kind: "forum" }) })?.url).toBe("https://elearn.isb.edu/mod/forum/view.php?f=99");
});
it("uses the course for prereads and unknown plugin activity types", () => {
  expect(elearnDestination({ moodleCourseId: 11057 })?.url).toBe("https://elearn.isb.edu/course/view.php?id=11057");
  expect(elearnDestination({ moodleCourseId: 11057, own: row({ kind: "choice" }) })?.activity).toBe(false);
});
it("never creates a destination from unvalidated IDs", () => {
  expect(elearnDestination({ moodleCourseId: -1 })).toBeNull();
  expect(elearnDestination({ moodleCourseId: null })).toBeNull();
  expect(elearnDestination({ moodleCourseId: 11057, own: row({ activity_id: -2 }) })?.activity).toBe(false);
});