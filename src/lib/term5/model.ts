/**
 * Browser-safe Term 5 merge logic: combines the student's own eLearn rows,
 * shared section updates and outline deadlines into one card per assessment.
 * Pure functions only — covered by tests.
 */

export const TERM5 = { academicYear: "2026-27", campus: "Mohali", term: "T5", tz: "Asia/Kolkata" } as const;
const OWN_FRESH_MS = 6 * 3600_000;
const SHARED_FRESH_MS = 12 * 3600_000;
const REMINDER_LEAD_MS = 3 * 3600_000;

export type Campus = "MOH" | "HYD";
const CAMPUS_SECTIONS: Record<Campus, string> = { MOH: "G-L", HYD: "A-C" };

/** Shared-pool key: Hyderabad and Mohali offerings with the same short code are different courses. */
export function sharedCourseKey(campus: Campus, code: string) {
  return campus === "MOH" ? code : `${campus}.${code}`;
}

export type Confidence = "own" | "shared" | "outline" | "provisional";

export type OutlineOccurrence = {
  occurrence_id: string;
  assessment_id: string;
  course_code: string;
  section_id: string | null;
  study_group_scope: string | number | null;
  title: string;
  date: string | null;
  time: string | null;
  due_at: string | null;
  date_precision: string;
  deadline_rule: string;
  provisional: boolean;
  notification_ready: boolean;
  source_id: string;
  source_pages: string | null;
  status: string;
};

export type OwnRow = {
  id: string;
  activity_id?: number | null;
  external_key?: string;
  title: string;
  kind: string;
  deadline_type: string;
  deadline_status: string;
  submission_status: string;
  due_at: string | null;
  conflict: boolean;
  moodle_course_id: number;
  source_primary: string;
  source_evidence?: unknown;
  text_evidence?: string | null;
  text_precision?: string | null;
};

export type SharedRow = {
  id: string;
  course_code: string;
  source_key: string;
  contributor_section: string;
  section_hint: string | null;
  kind: string;
  deadline_type: string;
  title: string;
  due_at: string | null;
  last_confirmed_at: string;
};

export type Enrollment = { courseCode: string; sectionId: string | null; studyGroup: string | number | null };
export type CourseRef = { moodle_course_id: number; short_name: string | null; full_name: string };

export type SourceRef = {
  kind: "own_elearn" | "shared_elearn" | "outline";
  dueAt: string | null;
  date: string | null;
  observedAt: string | null;
  note: string | null;
};

export type UnifiedDeadline = {
  id: string;
  /** Notification identities (own row id and/or outline occurrence id). */
  notifyKeys: string[];
  title: string;
  courseKey: string;
  courseCode: string;
  courseName: string;
  term: string;
  moodleCourseId: number | null;
  kind: string;
  deadlineType: string;
  dueAt: string | null;
  /** Known calendar date (YYYY-MM-DD) when no exact time exists. */
  dateOnly: string | null;
  submissionStatus: string;
  confidence: Confidence;
  sources: SourceRef[];
  conflict: boolean;
  provisional: boolean;
  remindable: boolean;
  otherSection: boolean;
  own?: OwnRow | undefined;
  outline?: OutlineOccurrence | undefined;
  preparation?: import("./preparation").PrepItem[];
  classRoom?: string;
};

/** Full course code for this campus's 2026-27 Term 5 eLearn course; never a prefix match or cross-campus. */
export function term5CodeFromShortName(shortName: string | null | undefined, campus: Campus = "MOH"): string | null {
  const m = new RegExp(`^([A-Za-z0-9.]+)_PGP${campus}_2026-27_T5$`).exec((shortName ?? "").trim());
  return m?.[1] ? m[1].toUpperCase() : null;
}

export function sectionLetter(sectionId: string | null): string | null {
  if (!sectionId) return null;
  const m = /_([A-Z])$/.exec(sectionId);
  return m?.[1] ?? null;
}

/** Section named explicitly in an eLearn title such as "Group Selection_G" or "(Section H)". */
export function sectionHintFromTitle(title: string, campus: Campus = "MOH"): string | null {
  const t = title.trim();
  const r = CAMPUS_SECTIONS[campus];
  const sec = new RegExp(`\\bsec(?:tion)?\\.?\\s*([${r}])\\b`, "i").exec(t);
  if (sec?.[1]) return sec[1].toUpperCase();
  const tail = new RegExp(`[_(\\-\\s]([${r}])\\)?$`).exec(t);
  return tail?.[1] ?? null;
}

const STOP = new Set(["the", "a", "an", "of", "and", "for", "to", "in", "on", "submission", "submit", "deadline", "due", "individual", "assignment", "case", "report", "write", "up"]);
function tokens(title: string) {
  return title
    .toLowerCase()
    .replace(/&amp;|&#0*38;|&#x0*26;/g, "&")
    .replace(/\bp\s*&\s*g\b/g, "procter gamble")
    .replace(/\bprocter\s*(?:&|and)\s*gamble\b/g, "procter gamble")
    .replace(/[_\-:()&,./]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

/** Assessment identity: same numbers and enough shared words — never title alone across courses. */
export function titlesMatch(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  const nums = (t: string[]) => t.filter((w) => /^\d+$/.test(w)).sort().join(",");
  if (nums(ta) !== nums(tb)) return false;
  const words = (t: string[]) => new Set(t.filter((w) => !/^\d+$/.test(w)));
  const wa = words(ta);
  const wb = words(tb);
  if (!wa.size || !wb.size) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.max(wa.size, wb.size) >= 0.75;
}

export function istDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TERM5.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Instant used for ordering and Upcoming/Past split. Date-only items count until end of that day. */
export function sortInstant(item: Pick<UnifiedDeadline, "dueAt" | "dateOnly">): number | null {
  if (item.dueAt) return new Date(item.dueAt).getTime();
  if (item.dateOnly) return new Date(`${item.dateOnly}T23:59:59+05:30`).getTime();
  return null;
}

function outlineDate(o: OutlineOccurrence) {
  return { dueAt: o.date_precision === "datetime" ? o.due_at : null, dateOnly: o.date_precision === "datetime" ? null : o.date };
}

function datesConflict(dueAt: string | null, o: OutlineOccurrence): boolean {
  if (!dueAt) return false;
  const od = outlineDate(o);
  if (od.dueAt) return Math.abs(new Date(dueAt).getTime() - new Date(od.dueAt).getTime()) > 60 * 60_000;
  if (od.dateOnly) return istDate(dueAt) !== od.dateOnly;
  return false;
}

function closeEnough(dueAt: string | null, o: OutlineOccurrence) {
  const od = outlineDate(o);
  const ref = od.dueAt ?? (od.dateOnly ? `${od.dateOnly}T12:00:00+05:30` : null);
  if (!dueAt || !ref) return true;
  return Math.abs(new Date(dueAt).getTime() - new Date(ref).getTime()) <= 10 * 86400_000;
}

export function applicableOutline(occ: OutlineOccurrence[], enrollments: Enrollment[]): OutlineOccurrence[] {
  return occ.filter((o) => {
    const e = enrollments.find((x) => x.courseCode === o.course_code);
    if (!e) return false;
    if (o.section_id && o.section_id !== e.sectionId) return false;
    if (o.study_group_scope != null && e.studyGroup != null && String(o.study_group_scope) !== String(e.studyGroup)) return false;
    return true;
  });
}

export type MergeInput = {
  now: number;
  enrollments: Enrollment[];
  courseTitles: Record<string, string>;
  outline: OutlineOccurrence[];
  own: OwnRow[];
  ownCourses: CourseRef[];
  ownLastSuccessAt: string | null;
  shared: SharedRow[];
  campus?: Campus;
};

export function mergeDeadlines(input: MergeInput): UnifiedDeadline[] {
  const { now, enrollments } = input;
  const myCodes = new Map(enrollments.map((e) => [e.courseCode, e]));
  const outline = applicableOutline(input.outline, enrollments);
  const used = new Set<string>();
  const out: UnifiedDeadline[] = [];
  const ownFresh = !!input.ownLastSuccessAt && now - new Date(input.ownLastSuccessAt).getTime() < OWN_FRESH_MS;

  const findOutline = (code: string, title: string, dueAt: string | null) => {
    const candidates = outline.filter((o) => !used.has(o.occurrence_id) && o.course_code === code && titlesMatch(o.title, title) && closeEnough(dueAt, o));
    return candidates.length === 1 ? candidates[0] : undefined;
  };

  const outlineSource = (o: OutlineOccurrence): SourceRef => ({
    kind: "outline",
    ...(() => {
      const d = outlineDate(o);
      return { dueAt: d.dueAt, date: d.dateOnly };
    })(),
    observedAt: null,
    note: o.provisional ? "Estimated from the outline and class schedule" : null,
  });

  // A date only "mentioned in course text" is dropped when the same course already has a structured
  // activity with the same title and due time (e.g. a Choice activity echoed in the course page).
  const structuredKeys = new Set(
    input.own.filter((r) => r.kind !== "text" && r.due_at).map((r) => `${r.moodle_course_id}|${r.title.trim().toLowerCase()}|${new Date(r.due_at as string).getTime()}`),
  );
  const assignments = input.own.filter((r) => r.kind === "assignment" && r.due_at);
  const ownRows = input.own.filter((r) => {
    if (!r.due_at) return true;
    const at = new Date(r.due_at).getTime();
    if (r.kind === "text") return !structuredKeys.has(`${r.moodle_course_id}|${r.title.trim().toLowerCase()}|${at}`);
    // Moodle's own "<assignment> is due" calendar echo of an assignment already listed.
    if (r.kind === "calendar")
      return !assignments.some((a) => a.moodle_course_id === r.moodle_course_id && new Date(a.due_at as string).getTime() === at && r.title.toLowerCase().includes(a.title.trim().toLowerCase()));
    return true;
  });

  for (const row of ownRows) {
    const course = input.ownCourses.find((c) => c.moodle_course_id === row.moodle_course_id);
    const code = term5CodeFromShortName(course?.short_name, input.campus);
    const enrollment = code ? myCodes.get(code) : undefined;
    const hint = sectionHintFromTitle(row.title, input.campus);
    const applicable = !hint || hint === sectionLetter(enrollment?.sectionId ?? null);
    const match = code && enrollment && applicable && row.deadline_type !== "cutoff" ? findOutline(code, row.title, row.due_at) : undefined;
    if (match) used.add(match.occurrence_id);
    const metaCode = code ?? (course?.short_name?.split("_")[0] || "Course");
    const termSeg = course?.short_name?.split("_").pop() || "Other";
    out.push({
      id: row.id,
      notifyKeys: match ? [row.id, match.occurrence_id] : [row.id],
      title: row.title,
      courseKey: code ? `T5:${code}` : `M:${row.moodle_course_id}`,
      courseCode: metaCode,
      courseName: course?.full_name || input.courseTitles[metaCode] || "Course",
      term: code ? "T5" : termSeg,
      moodleCourseId: row.moodle_course_id,
      kind: row.kind,
      deadlineType: row.deadline_type,
      dueAt: row.due_at,
      dateOnly: null,
      submissionStatus: row.submission_status,
      confidence: ownFresh ? "own" : "outline",
      sources: [
        { kind: "own_elearn", dueAt: row.due_at, date: null, observedAt: input.ownLastSuccessAt, note: null },
        ...(match ? [outlineSource(match)] : []),
      ],
      conflict: row.conflict || (match ? datesConflict(row.due_at, match) : false),
      provisional: false,
      remindable: !!row.due_at && row.submission_status !== "submitted",
      otherSection: false,
      own: row,
      outline: match,
    });
  }

  // Shared section updates only fill in for students without their own successful sync.
  if (!input.ownLastSuccessAt) {
    const seen = new Set<string>();
    const ranked = [...input.shared].sort((a, b) => {
      const ea = myCodes.get(a.course_code);
      const sa = a.contributor_section === sectionLetter(ea?.sectionId ?? null) ? 0 : 1;
      const eb = myCodes.get(b.course_code);
      const sb = b.contributor_section === sectionLetter(eb?.sectionId ?? null) ? 0 : 1;
      return sa - sb || b.last_confirmed_at.localeCompare(a.last_confirmed_at);
    });
    for (const s of ranked) {
      const e = myCodes.get(s.course_code);
      if (!e) continue;
      const mine = sectionLetter(e.sectionId);
      if (s.section_hint && s.section_hint !== mine) continue; // explicitly for another section
      const key = `${s.course_code}|${s.source_key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sameSection = !!mine && s.contributor_section === mine;
      const fresh = now - new Date(s.last_confirmed_at).getTime() < SHARED_FRESH_MS;
      const match = findOutline(s.course_code, s.title, s.due_at);
      if (match) used.add(match.occurrence_id);
      out.push({
        id: `shared:${s.id}`,
        notifyKeys: match ? [`shared:${s.course_code}:${s.source_key}`, match.occurrence_id] : [`shared:${s.course_code}:${s.source_key}`],
        title: s.title,
        courseKey: `T5:${s.course_code}`,
        courseCode: s.course_code,
        courseName: input.courseTitles[s.course_code] ?? s.course_code,
        term: "T5",
        moodleCourseId: null,
        kind: s.kind,
        deadlineType: s.deadline_type,
        dueAt: s.due_at,
        dateOnly: null,
        submissionStatus: "unknown",
        confidence: fresh && sameSection ? "shared" : "outline",
        sources: [
          {
            kind: "shared_elearn",
            dueAt: s.due_at,
            date: null,
            observedAt: s.last_confirmed_at,
            note: sameSection ? null : `From a classmate in section ${s.contributor_section}; may differ for your section`,
          },
          ...(match ? [outlineSource(match)] : []),
        ],
        conflict: match ? datesConflict(s.due_at, match) : false,
        provisional: false,
        remindable: !!s.due_at && sameSection,
        otherSection: !sameSection,
        outline: match,
      });
    }
  }

  for (const o of outline) {
    if (used.has(o.occurrence_id)) continue;
    const d = outlineDate(o);
    const undated = !d.dueAt && !d.dateOnly;
    out.push({
      id: `outline:${o.occurrence_id}`,
      notifyKeys: [o.occurrence_id],
      title: o.title,
      courseKey: `T5:${o.course_code}`,
      courseCode: o.course_code,
      courseName: input.courseTitles[o.course_code] ?? o.course_code,
      term: "T5",
      moodleCourseId: null,
      kind: "outline",
      deadlineType: "due",
      dueAt: d.dueAt,
      dateOnly: d.dateOnly,
      submissionStatus: "unknown",
      confidence: o.provisional || undated ? "provisional" : "outline",
      sources: [outlineSource(o)],
      conflict: false,
      provisional: o.provisional || undated,
      remindable: !!d.dueAt && o.notification_ready,
      otherSection: false,
      outline: o,
    });
  }
  return out;
}

export type DeadlineView = "upcoming" | "past";

/** Submitted undated → Past; unknown undated → Upcoming; submitted future-dated stays Upcoming. */
export function inView(item: Pick<UnifiedDeadline, "dueAt" | "dateOnly" | "submissionStatus">, view: DeadlineView, now: number) {
  const at = sortInstant(item);
  if (at === null) return view === (item.submissionStatus === "submitted" ? "past" : "upcoming");
  return view === "upcoming" ? at >= now : at < now;
}

export function sortView<T extends Pick<UnifiedDeadline, "dueAt" | "dateOnly" | "title">>(rows: T[], view: DeadlineView): T[] {
  return [...rows].sort((a, b) => {
    const x = sortInstant(a);
    const y = sortInstant(b);
    if (x === null) return y === null ? a.title.localeCompare(b.title) : 1;
    if (y === null) return -1;
    if (x === y) return a.title.localeCompare(b.title);
    return view === "upcoming" ? x - y : y - x;
  });
}

/** Items that should get their 3-hour reminder in this tick. */
export function dueForReminder(items: UnifiedDeadline[], now: number): UnifiedDeadline[] {
  return items.filter((i) => {
    if (!i.remindable || !i.dueAt || i.submissionStatus === "submitted") return false;
    const t = new Date(i.dueAt).getTime();
    return t > now && t <= now + REMINDER_LEAD_MS;
  });
}

export function withinReminderWindow(dueAt: string | null, now: number) {
  if (!dueAt) return false;
  const t = new Date(dueAt).getTime();
  return t > now && t <= now + REMINDER_LEAD_MS;
}
