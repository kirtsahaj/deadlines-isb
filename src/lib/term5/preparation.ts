import type { CourseRef, Enrollment, UnifiedDeadline } from "./model";
import { term5CodeFromShortName } from "./model";

export type PrepItem = {
  id: string; title: string; kind: string; requirement: string; timing: string; alsoFor: string[]; note: string | null;
};
export type ScheduleClass = {
  id: string; courseCode: string; courseName: string; section: string; startsAt: string; endsAt: string;
  room: string; sessionTitle: string | null; sessionLabels: string[]; mapping: string; sourceKind: string | null; prep: PrepItem[];
};
export type PrepCatalog = {
  classes: { class_id: string; course_code: string; section_id: string; starts_at: string; ends_at: string; room: string; outline_session_id: string | null; session_mapping_status: string }[];
  sessions: { outline_session_id: string; session_labels: string[]; title: string; source_id: string | null }[];
  prep: { preparation_id: string; course_code: string; applies_to_session_labels: string[]; title: string; kind: string; requirement: string; timing: string; source_requirement_note: string | null }[];
  sources: Record<string, { kind: string }>;
};

export function classesFor(cat: PrepCatalog, enrollments: Enrollment[], titles: Record<string, string>): ScheduleClass[] {
  const sections = new Set(enrollments.map(e => e.sectionId).filter(Boolean));
  return cat.classes.filter(c => sections.has(c.section_id)).map(c => {
    const session = cat.sessions.find(s => s.outline_session_id === c.outline_session_id);
    const labels = session?.session_labels ?? [];
    return {
      id: c.class_id, courseCode: c.course_code, courseName: titles[c.course_code] ?? c.course_code,
      section: c.section_id.split("_").pop() ?? "", startsAt: c.starts_at, endsAt: c.ends_at, room: c.room,
      sessionTitle: session?.title ?? null, sessionLabels: labels, mapping: c.session_mapping_status,
      sourceKind: session?.source_id ? cat.sources[session.source_id]?.kind ?? null : null,
      prep: session ? cat.prep.filter(p => p.course_code === c.course_code && p.applies_to_session_labels.some(l => labels.includes(l))).map(p => ({
        id: p.preparation_id, title: p.title, kind: p.kind, requirement: p.requirement, timing: p.timing,
        alsoFor: p.applies_to_session_labels.filter(l => !labels.includes(l)), note: p.source_requirement_note,
      })) : [],
    };
  });
}

/** One preread bundle per class; a reading shared across sessions appears only at its first class. */
export function prereadDeadlines(classes: ScheduleClass[], courses: CourseRef[]): UnifiedDeadline[] {
  const seen = new Set<string>();
  const result: UnifiedDeadline[] = [];
  for (const c of [...classes].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    if (!c.sessionTitle || !Number.isFinite(Date.parse(c.startsAt)) || /blocked|unmatched/.test(c.mapping)) continue;
    const prep = c.prep.filter(p => p.timing === "before_class" && ["reading", "case", "reference", "optional", "recommended", "watch", "listen"].includes(p.kind) && !seen.has(`${c.courseCode}:${p.id}`));
    if (!prep.length) continue;
    prep.forEach(p => seen.add(`${c.courseCode}:${p.id}`));
    const course = courses.find(r => term5CodeFromShortName(r.short_name) === c.courseCode);
    const provisional = c.mapping.includes("inference");
    result.push({
      id: `preread:${c.id}`, notifyKeys: prep.map(p => `preread:${c.courseCode}:${p.id}`),
      title: `Preread: ${c.sessionTitle}`, courseKey: `T5:${c.courseCode}`, courseCode: c.courseCode,
      courseName: c.courseName, term: "T5", moodleCourseId: course?.moodle_course_id ?? null,
      kind: "preread", deadlineType: "class_start", dueAt: c.startsAt, dateOnly: null,
      submissionStatus: "unknown", confidence: provisional ? "provisional" : "outline", provisional,
      remindable: true, conflict: false, otherSection: false,
      sources: [{ kind: "outline", dueAt: c.startsAt, date: null, observedAt: null,
        note: provisional ? "Class time from the schedule; reading/topic matched by class order and may change" : "Prepare before the scheduled class; not a submission deadline" }],
      preparation: prep, classRoom: c.room,
    });
  }
  return result;
}