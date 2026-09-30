import { extractDeadlines } from "./deadlineParser";

type Json = Record<string, unknown>;

export type DeadlineRow = {
  external_key: string;
  moodle_course_id: number;
  activity_id: number | null;
  kind: "assignment" | "quiz" | "forum" | "calendar" | "text";
  deadline_type: string;
  title: string;
  due_at: string | null;
  deadline_status: "dated" | "dated_from_text" | "TBD";
  submission_status: string;
  source_primary: string;
  source_evidence: Json[];
  text_evidence: string | null;
  text_precision: string | null;
  conflict: boolean;
  active: boolean;
  last_seen_at: string;
  removed_at: null;
};

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
const list = (value: unknown): Json[] =>
  Array.isArray(value)
    ? value.filter((item): item is Json => !!item && typeof item === "object")
    : [];
const iso = (seconds: number | null) => (seconds ? new Date(seconds * 1000).toISOString() : null);
const evidence = (source: string, timestamp: number | null): Json => ({ source, timestamp });

export function normalizeDeadlines(input: {
  assignments: Json;
  submissions: Map<number, Json>;
  quizzes: Json;
  forums: Json | Json[];
  calendar: Json;
  contents: Map<number, Json[]>;
  markerOnly?: boolean;
  nowSeconds?: number;
}): DeadlineRow[] {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const cutoff = now - 30 * 86400;
  const rows = new Map<string, DeadlineRow>();
  const seenAt = new Date().toISOString();

  const put = (row: Omit<DeadlineRow, "active" | "last_seen_at" | "removed_at">) => {
    if (row.due_at && Math.floor(new Date(row.due_at).getTime() / 1000) < cutoff) return;
    const existing = rows.get(row.external_key);
    if (existing) {
      existing.source_evidence.push(...row.source_evidence);
      existing.conflict ||= row.conflict;
      if (!existing.text_evidence && row.text_evidence) existing.text_evidence = row.text_evidence;
      return;
    }
    rows.set(row.external_key, { ...row, active: true, last_seen_at: seenAt, removed_at: null });
  };

  for (const course of list(input.assignments["courses"])) {
    const courseId = num(course["id"]);
    if (!courseId) continue;
    for (const assignment of list(course["assignments"])) {
      const id = num(assignment["id"]);
      if (!id) continue;
      const submission = input.submissions.get(id) ?? {};
      const attempt = (submission["lastattempt"] as Json | undefined) ?? {};
      const submitted = ((attempt["submission"] as Json | undefined) ??
        (attempt["teamsubmission"] as Json | undefined) ??
        {})["status"];
      const extension = num(attempt["extensionduedate"]);
      const due = Math.max(num(assignment["duedate"]) ?? 0, extension ?? 0) || null;
      const cutoffDate = num(assignment["cutoffdate"]);
      const title = String(assignment["name"] ?? "Untitled assignment");
      const common = {
        moodle_course_id: courseId,
        activity_id: id,
        kind: "assignment" as const,
        title,
        submission_status: typeof submitted === "string" ? submitted : "unknown",
        text_evidence: null,
        text_precision: null,
        conflict: false,
      };
      if (due) {
        put({
          ...common,
          external_key: `assignment:${courseId}:${id}:due`,
          deadline_type: "due",
          due_at: iso(due),
          deadline_status: "dated",
          source_primary: "mod_assign_get_assignments",
          source_evidence: [
            evidence("mod_assign_get_assignments", due),
            ...(extension
              ? [evidence("mod_assign_get_submission_status.extensionduedate", extension)]
              : []),
          ],
        });
      }
      if (cutoffDate) {
        put({
          ...common,
          external_key: `assignment:${courseId}:${id}:cutoff`,
          deadline_type: "cutoff",
          due_at: iso(cutoffDate),
          deadline_status: "dated",
          source_primary: "mod_assign_get_assignments",
          source_evidence: [evidence("mod_assign_get_assignments.cutoffdate", cutoffDate)],
        });
      }
      if (!due && !cutoffDate) {
        put({
          ...common,
          external_key: `assignment:${courseId}:${id}:tbd`,
          deadline_type: "unknown",
          due_at: null,
          deadline_status: "TBD",
          source_primary: "mod_assign_get_assignments",
          source_evidence: [evidence("mod_assign_get_assignments", null)],
        });
      }
    }
  }

  for (const quiz of list(input.quizzes["quizzes"])) {
    const id = num(quiz["id"]);
    const courseId = num(quiz["course"]);
    const due = num(quiz["timeclose"]);
    if (id && courseId && due) {
      put({
        external_key: `quiz:${courseId}:${id}:close`,
        moodle_course_id: courseId,
        activity_id: id,
        kind: "quiz",
        deadline_type: "close",
        title: String(quiz["name"] ?? "Untitled quiz"),
        due_at: iso(due),
        deadline_status: "dated",
        submission_status: "unknown",
        source_primary: "mod_quiz_get_quizzes_by_courses",
        source_evidence: [evidence("mod_quiz_get_quizzes_by_courses", due)],
        text_evidence: null,
        text_precision: null,
        conflict: false,
      });
    }
  }

  const forums = Array.isArray(input.forums) ? list(input.forums) : list(input.forums["forums"]);
  for (const forum of forums) {
    const id = num(forum["id"]);
    const courseId = num(forum["course"]);
    if (!id || !courseId) continue;
    for (const [field, type] of [
      ["duedate", "due"],
      ["cutoffdate", "cutoff"],
    ] as const) {
      const due = num(forum[field]);
      if (!due) continue;
      put({
        external_key: `forum:${courseId}:${id}:${type}`,
        moodle_course_id: courseId,
        activity_id: id,
        kind: "forum",
        deadline_type: type,
        title: String(forum["name"] ?? "Untitled forum"),
        due_at: iso(due),
        deadline_status: "dated",
        submission_status: "unknown",
        source_primary: "mod_forum_get_forums_by_courses",
        source_evidence: [evidence(`mod_forum_get_forums_by_courses.${field}`, due)],
        text_evidence: null,
        text_precision: null,
        conflict: false,
      });
    }
  }

  for (const event of list(input.calendar["events"])) {
    const activity = num(event["instance"]);
    const courseId = num(event["courseid"]) ?? num((event["course"] as Json | undefined)?.["id"]);
    const due = num(event["timestart"]);
    if (!courseId || !due) continue;
    const modul =
      event["modulename"] === "assign" ? "assignment" : String(event["modulename"] ?? "calendar");
    const type = String(event["eventtype"] ?? "event");
    // Moodle labels the same activity event differently across versions, so try
    // the reported event type first and then the keys we generate ourselves.
    const candidateKeys = activity
      ? [
          `${modul}:${courseId}:${activity}:${type}`,
          `${modul}:${courseId}:${activity}:due`,
          `${modul}:${courseId}:${activity}:close`,
          `${modul}:${courseId}:${activity}:tbd`,
        ]
      : [];
    const matching = candidateKeys.map((candidate) => rows.get(candidate)).find(Boolean);
    if (matching) {
      const structured = matching.due_at
        ? Math.floor(new Date(matching.due_at).getTime() / 1000)
        : null;
      matching.source_evidence.push(evidence("core_calendar_get_calendar_events", due));
      matching.conflict ||= structured !== null && structured !== due;
    } else {
      put({
        external_key: `calendar:${courseId}:${activity ?? num(event["id"]) ?? "event"}:${type}`,
        moodle_course_id: courseId,
        activity_id: activity,
        kind: "calendar",
        deadline_type: type,
        title: String(event["name"] ?? "Calendar event"),
        due_at: iso(due),
        deadline_status: "dated",
        submission_status: "unknown",
        source_primary: "core_calendar_get_calendar_events",
        source_evidence: [evidence("core_calendar_get_calendar_events", due)],
        text_evidence: null,
        text_precision: null,
        conflict: false,
      });
    }
  }

  for (const [courseId, sections] of input.contents) {
    for (const section of sections) {
      const sectionId = num(section["id"]);
      const candidates: Array<{ id: number | null; title: string; text: unknown; type: string }> = [
        {
          id: sectionId,
          title: String(section["name"] ?? "Course section"),
          text: section["summary"],
          type: "section",
        },
        ...list(section["modules"]).map((modul) => ({
          id: num(modul["instance"]) ?? num(modul["id"]),
          title: String(modul["name"] ?? "Course activity"),
          text: modul["description"],
          type: String(modul["modname"] ?? "module"),
        })),
      ];
      for (const candidate of candidates) {
        for (const parsed of extractDeadlines(
          typeof candidate.text === "string" ? candidate.text : "",
          input.markerOnly,
        )) {
          const assignmentKey = candidate.id ? `assignment:${courseId}:${candidate.id}:due` : "";
          const target = assignmentKey
            ? (rows.get(assignmentKey) ?? rows.get(`assignment:${courseId}:${candidate.id}:tbd`))
            : undefined;
          if (target) {
            const structured = target.due_at
              ? Math.floor(new Date(target.due_at).getTime() / 1000)
              : null;
            target.source_evidence.push(
              evidence("core_course_get_contents.description", parsed.timestamp),
            );
            target.text_evidence = parsed.text;
            target.text_precision = parsed.precision;
            if (structured === null) {
              target.due_at = parsed.dueIso;
              target.deadline_status = "dated_from_text";
            } else {
              target.conflict ||= structured !== parsed.timestamp;
            }
          } else {
            put({
              external_key: `text:${courseId}:${candidate.type}:${candidate.id ?? "none"}:${parsed.timestamp}`,
              moodle_course_id: courseId,
              activity_id: candidate.id,
              kind: "text",
              deadline_type: "text",
              title: candidate.title,
              due_at: parsed.dueIso,
              deadline_status: "dated_from_text",
              submission_status: "unknown",
              source_primary: "core_course_get_contents.description",
              source_evidence: [evidence("core_course_get_contents.description", parsed.timestamp)],
              text_evidence: parsed.text,
              text_precision: parsed.precision,
              conflict: false,
            });
          }
        }
      }
    }
  }
  return [...rows.values()];
}

export function sortDeadlines<T extends { due_at: string | null; title: string }>(
  rows: T[],
  order: "latest_first" | "soonest_first" = "latest_first",
): T[] {
  return [...rows].sort((a, b) => {
    if (a.due_at === null) return b.due_at === null ? a.title.localeCompare(b.title) : 1;
    if (b.due_at === null) return -1;
    const at = new Date(a.due_at).getTime();
    const bt = new Date(b.due_at).getTime();
    if (at === bt) return a.title.localeCompare(b.title);
    return order === "latest_first" ? bt - at : at - bt;
  });
}
