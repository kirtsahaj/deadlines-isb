import type { UnifiedDeadline } from "./term5/model";

/** Moodle instance IDs are not course-module IDs: assign uses a, quiz uses q, forum uses f. */
export function elearnDestination(item: Pick<UnifiedDeadline, "moodleCourseId" | "own">): { url: string; activity: boolean } | null {
  const course = item.moodleCourseId;
  if (!course || !Number.isSafeInteger(course) || course <= 0) return null;
  const row = item.own;
  const id = row?.activity_id ?? Number(row?.external_key?.split(":")[2]);
  const route = row?.kind === "assignment" ? ["assign", "a"] : row?.kind === "quiz" ? ["quiz", "q"] : row?.kind === "forum" ? ["forum", "f"] : null;
  if (route && Number.isSafeInteger(id) && id > 0) return { url: `https://elearn.isb.edu/mod/${route[0]}/view.php?${route[1]}=${id}`, activity: true };
  return { url: `https://elearn.isb.edu/course/view.php?id=${course}`, activity: false };
}